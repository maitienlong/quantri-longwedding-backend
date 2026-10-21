const ALBUM = require('../models/album.model');
const HOPDONG = require('../models/hopDong.model');
const axios = require('axios');
const crypto = require('crypto');

const verifyAlbumOwnership = async (album, user) => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  
  const hopDong = await HOPDONG.findOne({ maHopDong: album.maHopDong });
  if (!hopDong) return false;
  
  return hopDong.khachHang1.toString() === user.id || 
         (hopDong.khachHang2 && hopDong.khachHang2.toString() === user.id);
};

/**
 * Trích xuất và kiểm tra thông tin đường dẫn Google Drive / Photos
 */
const parseGoogleLink = (rawLink) => {
  if (!rawLink || typeof rawLink !== 'string') {
    return { valid: false, message: 'Đường dẫn không hợp lệ hoặc đang để trống.' };
  }

  const cleanLink = rawLink.trim();
  const isGooglePhotos = cleanLink.includes('photos.app.goo.gl') || cleanLink.includes('photos.google.com');

  if (isGooglePhotos) {
    return { valid: true, isGooglePhotos: true, target: cleanLink };
  }

  // Kiểm tra nếu người dùng vô tình dán link file đơn lẻ thay vì link thư mục
  if (cleanLink.includes('/file/d/')) {
    return {
      valid: false,
      message: 'Đường dẫn bạn nhập là một tệp đơn lẻ, không phải Thư mục. Vui lòng dán link Thư mục (Folder) Google Drive chứa ảnh.'
    };
  }

  // Bóc tách Folder ID
  let folderId = '';
  const folderMatch = cleanLink.match(/\/folders\/([a-zA-Z0-9\-_]{15,})/);
  const idMatch = cleanLink.match(/[?&]id=([a-zA-Z0-9\-_]{15,})/);
  const dMatch = cleanLink.match(/\/d\/([a-zA-Z0-9\-_]{15,})/);

  if (folderMatch) {
    folderId = folderMatch[1];
  } else if (idMatch) {
    folderId = idMatch[1];
  } else if (dMatch) {
    folderId = dMatch[1];
  } else if (/^[a-zA-Z0-9\-_]{15,50}$/.test(cleanLink)) {
    folderId = cleanLink;
  } else {
    // Thử tách phần cuối cùng của đường dẫn nếu là ID
    const noQuery = cleanLink.split('?')[0].replace(/\/+$/, '');
    const parts = noQuery.split('/');
    const last = parts[parts.length - 1];
    if (last && /^[a-zA-Z0-9\-_]{15,50}$/.test(last)) {
      folderId = last;
    }
  }

  if (!folderId) {
    return {
      valid: false,
      message: 'Không thể nhận diện mã thư mục (Folder ID) từ đường dẫn Google Drive. Vui lòng kiểm tra lại đường link.'
    };
  }

  return { valid: true, isGooglePhotos: false, target: folderId, folderId };
};

/**
 * Gọi Google Apps Script lấy danh sách file Drive kèm cơ chế Retry tự động
 */
const fetchDriveFilesWithRetry = async (folderId, maxRetries = 1) => {
  const scriptUrl = process.env.APPS_SCRIPT_URL;
  if (!scriptUrl) {
    throw new Error('Chưa cấu hình biến APPS_SCRIPT_URL trong file .env của backend.');
  }

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(`${scriptUrl}?folderId=${folderId}`, {
        timeout: 65000, // Chờ tối đa 65s cho các thư mục lớn
        headers: {
          'User-Agent': 'LongWedding-SyncClient/2.0'
        }
      });

      if (!response.data) {
        throw new Error('Không nhận được dữ liệu phản hồi từ Google Apps Script.');
      }

      if (response.data.status !== 'success') {
        const msg = response.data.message || 'Lỗi truy xuất từ Google Apps Script.';
        const err = new Error(msg);
        err.code = response.data.code;
        throw err;
      }

      const files = response.data.data || [];
      return {
        files: files.map(f => ({
          id: f.id,
          name: f.name,
          urlGoc: `https://drive.google.com/uc?id=${f.id}`,
          urlNen: `https://drive.google.com/thumbnail?id=${f.id}&sz=w1000`
        })),
        folderName: response.data.folderName || 'Google Drive Folder',
        method: response.data.method || 'AppsScript'
      };

    } catch (err) {
      lastError = err;
      console.warn(`[DriveSync] Lần thử ${attempt + 1}/${maxRetries + 1} thất bại:`, err.message);

      // Nếu là lỗi phân quyền rõ ràng thì không cần retry vô ích
      if (err.code === 'PERMISSION_DENIED' || err.code === 'NOT_A_FOLDER' || err.message?.includes('quyền truy cập') || err.message?.includes('chia sẻ')) {
        break;
      }

      if (attempt < maxRetries) {
        // Đợi 2 giây trước khi thử lại
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }

  throw lastError;
};

/**
 * Trích xuất ảnh từ Album Google Photos (Nâng cấp đa luồng Regex & JSON Parsing)
 */
const fetchGooglePhotosFiles = async (photosUrl) => {
  const response = await axios.get(photosUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
    },
    maxRedirects: 10,
    timeout: 30000
  });

  const html = response.data || '';

  // 1. Trích xuất toàn bộ URL chứa /pw/ (Public Web của Google Photos)
  const pwRegex = /https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9\-_]+/g;
  let matches = html.match(pwRegex) || [];

  // 2. Nếu không có /pw/, tìm kiếm các URL ảnh chất lượng cao trên googleusercontent
  if (matches.length === 0) {
    const rawLh3 = html.match(/https:\/\/[a-z0-9\-_.]+\.googleusercontent\.com\/[A-Za-z0-9\-_]{60,}/g) || [];
    // Lọc bỏ avatar, icon hệ thống (ogw, photosui, google logo)
    matches = rawLh3.filter(u => !u.includes('/ogw/') && !u.includes('/a/ACg') && !u.includes('photosui') && !u.includes('default-user'));
  }

  // 3. Tìm kiếm trong các mảng dữ liệu JSON nếu regex thông thường chưa đủ
  if (matches.length === 0) {
    const jsonMatches = html.match(/\["(https:\/\/[^"]+googleusercontent[^"]+)",\d+,\d+/g) || [];
    jsonMatches.forEach(m => {
      const uMatch = m.match(/https:\/\/[^"]+/);
      if (uMatch) matches.push(uMatch[0]);
    });
  }

  const uniqueUrls = [...new Set(matches)];
  const photoUrls = uniqueUrls.filter(url => url.length > 50 && !url.includes('=s'));

  if (photoUrls.length === 0) {
    throw new Error('Không tìm thấy ảnh nào trong Album Google Photos này. Vui lòng đảm bảo album đã được bật quyền: "Bất kỳ ai có đường liên kết đều xem được", hoặc ưu tiên dùng Thư mục Google Drive.');
  }

  // Trích xuất tên file nguyên bản từ HTML
  const filenameRegex = /"([^"\/\\#\?]+\.(?:jpg|jpeg|png|heic|heif|gif|JPG|JPEG|PNG|HEIC|HEIF|GIF))"/g;
  const filenames = [];
  let fMatch;
  while ((fMatch = filenameRegex.exec(html)) !== null) {
    filenames.push(fMatch[1]);
  }

  return {
    files: photoUrls.map((url, index) => ({
      id: url.split('/').pop().replace(/=.*$/, ''),
      name: filenames[index] || `Photo_${index + 1}.jpg`,
      urlGoc: `${url}=s0`,
      urlNen: `${url}=w1000`
    })),
    folderName: 'Google Photos Album',
    method: 'GooglePhotos_Scraper'
  };
};

/**
 * Xử lý đồng bộ ảnh và cập nhật vào Database
 */
const processImagesInBackground = async (albumId, parsedInfo, loaiAnh) => {
  const album = await ALBUM.findById(albumId);
  if (!album) {
    return { success: false, message: 'Không tìm thấy Album trong cơ sở dữ liệu.' };
  }

  try {
    let resultFiles = [];

    if (parsedInfo.isGooglePhotos) {
      const gPhotosResult = await fetchGooglePhotosFiles(parsedInfo.target);
      resultFiles = gPhotosResult.files;
    } else {
      const driveResult = await fetchDriveFilesWithRetry(parsedInfo.target, 1);
      resultFiles = driveResult.files;
    }

    if (!resultFiles || resultFiles.length === 0) {
      if (loaiAnh === 'goc') {
        album.danhSachAnh = [];
        album.trangThai = 'Hoàn thành';
      } else {
        album.danhSachAnhChinhSua = [];
        album.trangThaiChinhSua = 'Hoàn thành';
      }
      album.lastError = '';
      await album.save();
      return { success: true, count: 0, message: 'Thư mục hiện tại không có ảnh nào.', album };
    }

    // Bảo tồn các lựa chọn cũ của khách (thả tim, bình luận)
    const existingPhotosMap = new Map();
    const currentList = loaiAnh === 'goc' ? (album.danhSachAnh || []) : (album.danhSachAnhChinhSua || []);
    currentList.forEach(p => {
      if (p.idDrive) existingPhotosMap.set(p.idDrive, p);
      if (p.tenFile) existingPhotosMap.set(p.tenFile, p);
    });

    const newPhotos = [];
    for (let file of resultFiles) {
      const existing = existingPhotosMap.get(file.id) || existingPhotosMap.get(file.name);
      newPhotos.push({
        idDrive: file.id,
        tenFile: file.name,
        urlGoc: file.urlGoc,
        urlNen: file.urlNen,
        isHearted: existing ? Boolean(existing.isHearted) : false,
        comments: existing ? (existing.comments || []) : []
      });
    }

    if (loaiAnh === 'goc') {
      album.danhSachAnh = newPhotos;
      album.trangThai = 'Hoàn thành';
    } else {
      album.danhSachAnhChinhSua = newPhotos;
      album.trangThaiChinhSua = 'Hoàn thành';
    }
    album.lastError = '';
    await album.save();

    return {
      success: true,
      count: newPhotos.length,
      message: `Đã đồng bộ thành công ${newPhotos.length} ảnh.`,
      album
    };

  } catch (err) {
    console.error(`[SyncError] maHopDong: ${album.maHopDong}, loaiAnh: ${loaiAnh} -`, err.message);

    let friendlyMessage = err.message || 'Lỗi đồng bộ ảnh từ Google.';
    if (friendlyMessage.includes('timeout') || err.code === 'ECONNABORTED') {
      friendlyMessage = 'Thời gian đồng bộ quá lâu do thư mục có quá nhiều ảnh hoặc mạng chập chờn. Vui lòng bấm thử lại!';
    } else if (friendlyMessage.includes('Network Error')) {
      friendlyMessage = 'Không thể kết nối đến máy chủ Google. Vui lòng kiểm tra lại kết nối mạng.';
    }

    if (loaiAnh === 'goc') {
      album.trangThai = 'Lỗi đồng bộ';
    } else {
      album.trangThaiChinhSua = 'Lỗi đồng bộ';
    }
    album.lastError = friendlyMessage;
    await album.save();

    return {
      success: false,
      message: friendlyMessage,
      code: err.code || 'SYNC_FAILED',
      album
    };
  }
};

/**
 * Controller chính xử lý Request đồng bộ từ Quản trị
 */
const syncDriveToAlbum = async (req, res) => {
  try {
    const { maHopDong, driveLink, loaiAnh = 'goc' } = req.body;
    if (!maHopDong || !driveLink) {
      return res.status(400).json({ status: 'error', message: 'Thiếu thông tin maHopDong hoặc driveLink.' });
    }

    const parsedInfo = parseGoogleLink(driveLink);
    if (!parsedInfo.valid) {
      return res.status(400).json({ status: 'error', message: parsedInfo.message });
    }

    // Tạo publicLink ngẫu nhiên nếu chưa có
    const publicLink = crypto.randomBytes(8).toString('hex');

    // Tìm hoặc tạo album mới
    let album = await ALBUM.findOne({ maHopDong });
    if (!album) {
      album = new ALBUM({
        maHopDong,
        driveLink,
        publicLink,
        trangThai: loaiAnh === 'goc' ? 'Đang xử lý' : 'Đã tạo',
        trangThaiChinhSua: loaiAnh === 'chinhSua' ? 'Đang xử lý' : 'Chưa đồng bộ',
        danhSachAnh: [],
        danhSachAnhChinhSua: []
      });
    } else {
      if (loaiAnh === 'goc') {
        album.driveLink = driveLink;
        album.trangThai = 'Đang xử lý';
      } else {
        album.trangThaiChinhSua = 'Đang xử lý';
      }
    }
    await album.save();

    // Tự động cập nhật link vào hợp đồng ngay khi đồng bộ
    if (loaiAnh === 'goc') {
      await HOPDONG.updateOne({ maHopDong }, { linkAnhGoc: driveLink });
    } else {
      await HOPDONG.updateOne({ maHopDong }, { linkAnhChinhSua: driveLink });
    }

    // Thực hiện đồng bộ
    const result = await processImagesInBackground(album._id, parsedInfo, loaiAnh);

    if (!result.success) {
      return res.status(400).json({
        status: 'error',
        message: result.message,
        code: result.code,
        album: result.album
      });
    }

    return res.status(200).json({
      status: 'success',
      message: result.message,
      count: result.count,
      album: result.album
    });

  } catch (error) {
    console.error("Error in syncDriveToAlbum controller:", error);
    return res.status(500).json({ status: 'error', message: 'Lỗi máy chủ khi xử lý đồng bộ ảnh.' });
  }
};

const getAdminAlbums = async (req, res) => {
  try {
    const albums = await ALBUM.find().sort({ createdAt: -1 });
    return res.status(200).json({ status: 'success', albums });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const getAdminAlbumDetail = async (req, res) => {
  try {
    const { maHopDong } = req.params;
    let album = await ALBUM.findOne({ maHopDong });

    // Tự động kiểm tra và khởi tạo album nếu hợp đồng đã có link drive mà chưa tạo album document
    if (!album) {
      const hopDong = await HOPDONG.findOne({ maHopDong });
      const driveLink = hopDong?.linkAnhGoc || hopDong?.linkAnhChinhSua;
      if (driveLink) {
        const loaiAnh = hopDong?.linkAnhChinhSua ? 'chinhSua' : 'goc';
        const parsed = parseGoogleLink(driveLink);
        if (parsed.valid) {
          const publicLink = crypto.randomBytes(8).toString('hex');
          const shareLink = crypto.randomBytes(6).toString('hex');
          album = new ALBUM({
            maHopDong,
            driveLink,
            publicLink,
            shareLink,
            trangThai: 'Đang xử lý',
            danhSachAnh: []
          });
          await album.save();

          processImagesInBackground(album._id, parsed, loaiAnh).catch(err => console.error("Lỗi auto sync background:", err));
        }
      }
    }

    if (album && !album.shareLink) {
      album.shareLink = crypto.randomBytes(6).toString('hex');
      await album.save();
    }

    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });
    return res.status(200).json({ status: 'success', album });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const getCustomerAlbum = async (req, res) => {
  try {
    const { publicLink } = req.params;
    const album = await ALBUM.findOne({ publicLink });
    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });
    
    const isOwner = await verifyAlbumOwnership(album, req.user);
    if (!isOwner) return res.status(403).json({ status: 'error', message: 'Bạn không có quyền xem album này' });
    
    return res.status(200).json({ status: 'success', album });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const heartImage = async (req, res) => {
  try {
    const { publicLink } = req.params;
    const { idDrive, isHearted } = req.body;
    
    const album = await ALBUM.findOne({ publicLink });
    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });

    const isOwner = await verifyAlbumOwnership(album, req.user);
    if (!isOwner) return res.status(403).json({ status: 'error', message: 'Bạn không có quyền thao tác trên album này' });

    const photo = album.danhSachAnh.find(p => p.idDrive === idDrive);
    if (!photo) return res.status(404).json({ status: 'error', message: 'Không tìm thấy ảnh' });

    photo.isHearted = isHearted;
    await album.save();

    return res.status(200).json({ status: 'success', message: 'Đã cập nhật trạng thái' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const commentImage = async (req, res) => {
  try {
    const { publicLink } = req.params;
    const { idDrive, noiDung } = req.body;
    
    const album = await ALBUM.findOne({ publicLink });
    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });

    const isOwner = await verifyAlbumOwnership(album, req.user);
    if (!isOwner) return res.status(403).json({ status: 'error', message: 'Bạn không có quyền thao tác trên album này' });

    let photo = album.danhSachAnh.find(p => p.idDrive === idDrive);
    if (!photo) {
      photo = album.danhSachAnhChinhSua.find(p => p.idDrive === idDrive);
    }
    if (!photo) return res.status(404).json({ status: 'error', message: 'Không tìm thấy ảnh' });

    photo.comments.push({ noiDung, ngayTao: new Date() });
    await album.save();

    return res.status(200).json({ status: 'success', message: 'Đã thêm bình luận', comments: photo.comments });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const updateAlbumSettings = async (req, res) => {
  try {
    const { maHopDong } = req.params;
    const { coGioiHanAnh, soLuongAnhGioiHan, khachHangXacNhan, isSpecialCollection, chuDe } = req.body;
    
    const album = await ALBUM.findOne({ maHopDong });
    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });

    if (coGioiHanAnh !== undefined) album.coGioiHanAnh = coGioiHanAnh;
    if (soLuongAnhGioiHan !== undefined) album.soLuongAnhGioiHan = soLuongAnhGioiHan;
    if (khachHangXacNhan !== undefined) album.khachHangXacNhan = khachHangXacNhan;
    if (chuDe !== undefined) album.chuDe = chuDe;

    await album.save();

    if (isSpecialCollection !== undefined) {
      await HOPDONG.updateOne({ maHopDong }, { isSpecialCollection });
    }

    return res.status(200).json({ status: 'success', message: 'Đã cập nhật cài đặt', album });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const completeSelection = async (req, res) => {
  try {
    const { publicLink } = req.params;
    const album = await ALBUM.findOne({ publicLink });
    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });

    const isOwner = await verifyAlbumOwnership(album, req.user);
    if (!isOwner) return res.status(403).json({ status: 'error', message: 'Bạn không có quyền thao tác trên album này' });

    album.khachHangXacNhan = true;
    album.ngayKhachXacNhan = new Date();
    await album.save();

    return res.status(200).json({ status: 'success', message: 'Đã hoàn thành chọn ảnh' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const generateShareLink = async (req, res) => {
  try {
    const { publicLink } = req.params;
    const album = await ALBUM.findOne({ publicLink });
    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });

    const isOwner = await verifyAlbumOwnership(album, req.user);
    if (!isOwner) return res.status(403).json({ status: 'error', message: 'Bạn không có quyền tạo link chia sẻ cho album này' });

    if (!album.shareLink) {
      album.shareLink = crypto.randomBytes(6).toString('hex');
      await album.save();
    }

    return res.status(200).json({ status: 'success', shareLink: album.shareLink });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const getSharedAlbum = async (req, res) => {
  try {
    const { shareLink } = req.params;
    const album = await ALBUM.findOne({ shareLink });
    if (!album) return res.status(404).json({ status: 'error', message: 'Link chia sẻ không hợp lệ hoặc không tồn tại' });
    
    // Lấy tên khách hàng từ hợp đồng
    const hopDong = await HOPDONG.findOne({ maHopDong: album.maHopDong }).populate('khachHang1', 'tenKhachHang').populate('khachHang2', 'tenKhachHang');
    let tenKhachHang = '';
    if (hopDong) {
      const names = [];
      if (hopDong.khachHang1 && hopDong.khachHang1.tenKhachHang) names.push(hopDong.khachHang1.tenKhachHang);
      if (hopDong.khachHang2 && hopDong.khachHang2.tenKhachHang) names.push(hopDong.khachHang2.tenKhachHang);
      tenKhachHang = names.join(' & ');
    }

    // Chỉ trả về ảnh đã chỉnh sửa
    return res.status(200).json({ 
      status: 'success', 
      album: {
        danhSachAnhChinhSua: album.danhSachAnhChinhSua,
        maHopDong: album.maHopDong,
        chuDe: album.chuDe,
        tenKhachHang: tenKhachHang
      } 
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const getSharedAlbumSeo = async (req, res) => {
  try {
    const { shareLink } = req.params;
    const album = await ALBUM.findOne({ shareLink });
    if (!album) {
      return res.status(404).send('Link chia sẻ không hợp lệ hoặc không tồn tại');
    }

    // Lấy tên khách hàng từ hợp đồng
    const hopDong = await HOPDONG.findOne({ maHopDong: album.maHopDong }).populate('khachHang1', 'tenKhachHang').populate('khachHang2', 'tenKhachHang');
    let tenKhachHang = '';
    if (hopDong) {
      const names = [];
      if (hopDong.khachHang1 && hopDong.khachHang1.tenKhachHang) names.push(hopDong.khachHang1.tenKhachHang);
      if (hopDong.khachHang2 && hopDong.khachHang2.tenKhachHang) names.push(hopDong.khachHang2.tenKhachHang);
      tenKhachHang = names.join(' & ');
    }

    const chuDe = album.chuDe || 'Album ảnh cưới';
    const clientNameText = tenKhachHang ? ` - Khách hàng: ${tenKhachHang}` : '';
    const description = `Chủ đề: ${chuDe}${clientNameText}`;
    const title = 'Long Wedding Studio - Đẳng cấp & Sang trọng';

    // Lấy ảnh đầu tiên trong danh mục chỉnh sửa để hiển thị xem trước
    let imageUrl = 'https://longwedding.vn/logo192.png';
    if (album.danhSachAnhChinhSua && album.danhSachAnhChinhSua.length > 0) {
      imageUrl = album.danhSachAnhChinhSua[0].urlNen || imageUrl;
    }

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook / Zalo -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://longwedding.vn/shared-album/${shareLink}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="https://longwedding.vn/shared-album/${shareLink}">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:description" content="${description}">
  <meta property="twitter:image" content="${imageUrl}">

  <!-- Redirect to main React app -->
  <script>
    window.location.href = "https://longwedding.vn/shared-album/${shareLink}";
  </script>
</head>
<body>
  <p>Đang chuyển hướng đến album của ${tenKhachHang || 'Khách hàng'}...</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Lỗi getSharedAlbumSeo:', error);
    return res.status(500).send('Lỗi máy chủ nội bộ');
  }
};

const convertDriveToBase64 = async (req, res) => {
  try {
    const { idDrive, url } = req.body;
    let targetUrl = url;

    if (idDrive) {
      targetUrl = `https://drive.google.com/uc?export=download&id=${idDrive}`;
    }

    if (!targetUrl) {
      return res.status(400).json({ status: 'error', message: 'Thiếu thông tin idDrive hoặc url' });
    }

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      maxRedirects: 5
    });

    const mimeType = response.headers['content-type'] || 'image/jpeg';
    const base64Buffer = Buffer.from(response.data).toString('base64');
    const base64Data = `data:${mimeType};base64,${base64Buffer}`;

    return res.status(200).json({
      status: 'success',
      base64: base64Data,
      mimeType
    });
  } catch (error) {
    console.error('Lỗi convertDriveToBase64:', error.message);
    return res.status(500).json({ status: 'error', message: 'Không thể chuyển đổi ảnh từ Google Drive sang Base64 trên server' });
  }
};

module.exports = {
  syncDriveToAlbum,
  getAdminAlbums,
  getAdminAlbumDetail,
  getCustomerAlbum,
  heartImage,
  commentImage,
  updateAlbumSettings,
  completeSelection,
  generateShareLink,
  getSharedAlbum,
  getSharedAlbumSeo,
  convertDriveToBase64
};
