const ALBUM = require('../models/album.model');
const HOPDONG = require('../models/hopDong.model');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

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

    let contract = null;
    let otherAlbums = [];
    if (album.maHopDong) {
      contract = await HOPDONG.findOne({ maHopDong: album.maHopDong })
        .select('maHopDong gioHang dichVuChinh linkAnhGoc linkAnhChinhSua extraDriveLinks cacNgay khachHang1 khachHang2 ghiChu')
        .populate('gioHang.dichVu', 'tenDichVu loaiDichVu maDichVu')
        .lean();

      if (contract) {
        otherAlbums = await ALBUM.find({
          maHopDong: contract.maHopDong,
          publicLink: { $ne: publicLink }
        }).select('publicLink chuDe trangThai soLuongAnhGioiHan driveLink').lean();
      }
    }

    return res.status(200).json({ status: 'success', album, contract, otherAlbums });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const heartImage = async (req, res) => {
  try {
    const { publicLink } = req.params;
    const { idDrive, isHearted, isCover } = req.body;

    const album = await ALBUM.findOne({ publicLink });
    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });

    const isOwner = await verifyAlbumOwnership(album, req.user);
    if (!isOwner) return res.status(403).json({ status: 'error', message: 'Bạn không có quyền thao tác trên album này' });

    const photo = album.danhSachAnh.find(p => p.idDrive === idDrive);
    if (!photo) return res.status(404).json({ status: 'error', message: 'Không tìm thấy ảnh' });

    if (isCover !== undefined) {
      photo.isCover = Boolean(isCover);
      if (photo.isCover) photo.isHearted = true;
    }
    if (isHearted !== undefined) {
      photo.isHearted = Boolean(isHearted);
      if (!photo.isHearted) photo.isCover = false;
    }
    await album.save();

    return res.status(200).json({ status: 'success', message: 'Đã cập nhật trạng thái', isHearted: photo.isHearted, isCover: photo.isCover });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const coverImage = async (req, res) => {
  try {
    const { publicLink } = req.params;
    const { idDrive, isCover } = req.body;

    const album = await ALBUM.findOne({ publicLink });
    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });

    const isOwner = await verifyAlbumOwnership(album, req.user);
    if (!isOwner) return res.status(403).json({ status: 'error', message: 'Bạn không có quyền thao tác trên album này' });

    const photo = album.danhSachAnh.find(p => p.idDrive === idDrive);
    if (!photo) return res.status(404).json({ status: 'error', message: 'Không tìm thấy ảnh' });

    photo.isCover = isCover !== undefined ? Boolean(isCover) : !photo.isCover;
    if (photo.isCover) photo.isHearted = true;
    await album.save();

    return res.status(200).json({ status: 'success', message: 'Đã cập nhật ảnh cổng', isCover: photo.isCover, isHearted: photo.isHearted });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
  }
};

const commentImage = async (req, res) => {
  try {
    const { publicLink } = req.params;
    const { idDrive, noiDung, coordinateX, coordinateY, normalizedX, normalizedY } = req.body;

    const album = await ALBUM.findOne({ publicLink });
    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });

    const isOwner = await verifyAlbumOwnership(album, req.user);
    if (!isOwner) return res.status(403).json({ status: 'error', message: 'Bạn không có quyền thao tác trên album này' });

    let photo = album.danhSachAnh.find(p => p.idDrive === idDrive);
    if (!photo) {
      photo = album.danhSachAnhChinhSua.find(p => p.idDrive === idDrive);
    }
    if (!photo) return res.status(404).json({ status: 'error', message: 'Không tìm thấy ảnh' });

    const newComment = {
      noiDung,
      coordinateX: coordinateX !== undefined ? Number(coordinateX) : undefined,
      coordinateY: coordinateY !== undefined ? Number(coordinateY) : undefined,
      normalizedX: normalizedX !== undefined ? Number(normalizedX) : undefined,
      normalizedY: normalizedY !== undefined ? Number(normalizedY) : undefined,
      author: req.user?.fullname || 'Khách hàng',
      ngayTao: new Date()
    };
    photo.comments.push(newComment);
    if (photo.isHearted === false) {
      photo.isHearted = true;
    }
    await album.save();

    return res.status(200).json({ status: 'success', message: 'Đã thêm bình luận', comments: photo.comments, comment: newComment });
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

const isAllowedMediaHost = (hostname) => {
  if (!hostname || typeof hostname !== 'string') return false;
  const host = hostname.toLowerCase().trim();
  if (host === 'drive.google.com' || host === 'docs.google.com' || host === 'images.unsplash.com') {
    return true;
  }
  if (host.endsWith('.googleusercontent.com') && !host.includes('..')) {
    return true;
  }
  return false;
};

const isBlockedIpOrHost = (hostname) => {
  if (!hostname) return true;
  const h = hostname.toLowerCase().trim();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
  if (h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('169.254.')) return true;
  const match172 = h.match(/^172\.(\d+)\./);
  if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) return true;
  return false;
};

const convertDriveToBase64 = async (req, res) => {
  try {
    const { idDrive, url } = req.body || {};
    let targetUrl = '';

    if (idDrive) {
      if (typeof idDrive !== 'string' || !/^[a-zA-Z0-9_\-]{15,100}$/.test(idDrive.trim())) {
        return res.status(400).json({ status: 'error', message: 'Mã idDrive không hợp lệ' });
      }
      targetUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(idDrive.trim())}`;
    } else if (url) {
      if (typeof url !== 'string') {
        return res.status(400).json({ status: 'error', message: 'URL không hợp lệ' });
      }
      try {
        const parsedUrl = new URL(url.trim());
        if (parsedUrl.protocol !== 'https:') {
          return res.status(400).json({ status: 'error', message: 'Chỉ chấp nhận giao thức bảo mật HTTPS' });
        }
        if (isBlockedIpOrHost(parsedUrl.hostname) || !isAllowedMediaHost(parsedUrl.hostname)) {
          return res.status(403).json({ status: 'error', message: 'Tên miền tải ảnh không nằm trong danh sách cho phép (SSRF Blocked)' });
        }
        targetUrl = parsedUrl.href;
      } catch (parseErr) {
        return res.status(400).json({ status: 'error', message: 'Đường dẫn URL không hợp lệ' });
      }
    }

    if (!targetUrl) {
      return res.status(400).json({ status: 'error', message: 'Thiếu thông tin idDrive hoặc url hợp lệ' });
    }

    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      },
      timeout: 10000,
      maxContentLength: 25 * 1024 * 1024,
      maxRedirects: 2
    });

    const mimeType = response.headers['content-type'] || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ status: 'error', message: 'Tệp tải về không phải định dạng hình ảnh hợp lệ' });
    }

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

// =========================================================================
// CLIENT PORTAL ENDPOINTS (/api/album/portal/:maHopDong)
// =========================================================================

const getPortalInfo = async (req, res) => {
  try {
    const { maHopDong } = req.params;
    if (!maHopDong) {
      return res.status(400).json({ status: 'error', message: 'Thiếu mã hợp đồng' });
    }

    const contract = await HOPDONG.findOne({
      maHopDong: { $regex: new RegExp(`^${maHopDong.trim()}$`, 'i') }
    })
      .populate('khachHang1', 'tenKhachHang soDienThoai')
      .populate('khachHang2', 'tenKhachHang soDienThoai');

    if (!contract) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy hợp đồng' });
    }

    let album = await ALBUM.findOne({ maHopDong: contract.maHopDong });
    if (!album) {
      const driveLink = contract.linkAnhGoc || contract.linkAnhChinhSua;
      if (driveLink) {
        const loaiAnh = contract.linkAnhChinhSua ? 'chinhSua' : 'goc';
        const parsed = parseGoogleLink(driveLink);
        if (parsed.valid) {
          const publicLink = crypto.randomBytes(8).toString('hex');
          const shareLink = crypto.randomBytes(6).toString('hex');
          album = new ALBUM({
            maHopDong: contract.maHopDong,
            driveLink,
            publicLink,
            shareLink,
            trangThai: 'Đang xử lý',
            danhSachAnh: []
          });
          await album.save();
          processImagesInBackground(album._id, parsed, loaiAnh).catch(err =>
            console.error('Lỗi auto sync portal background:', err)
          );
        }
      }
    }

    // Lấy thông tin ngân hàng SePay để tạo QR thật
    const SepayConfig = require('../models/sepayConfig.model');
    const sepayConfig = await SepayConfig.findOne();
    const bankName = sepayConfig?.bankName || process.env.SEPAY_BANK_NAME || 'MBBank';
    const accountNumber = sepayConfig?.accountNumber || process.env.SEPAY_ACCOUNT_NUMBER || '';
    const accountName = sepayConfig?.accountName || process.env.SEPAY_ACCOUNT_NAME || '';

    const tongTien = contract.thanhToan?.tongGiaTriSauGiam ?? contract.thanhToan?.tongGiaTri ?? 0;
    const daThanhToan = contract.thanhToan?.khachHangDaThanhToan ?? 0;
    const conLai = Math.max(0, tongTien - daThanhToan);
    const cleanMa = contract.maHopDong.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    const sepayQrUrl = accountNumber
      ? `https://qr.sepay.vn/img?bank=${encodeURIComponent(bankName)}&acc=${encodeURIComponent(accountNumber)}&template=qr_only&amount=${conLai}&des=${encodeURIComponent(cleanMa)}`
      : '';

    return res.status(200).json({
      status: 'success',
      data: {
        contract: {
          _id: contract._id,
          maHopDong: contract.maHopDong,
          ngayHopDong: contract.ngayHopDong,
          khachHang1: contract.khachHang1,
          khachHang2: contract.khachHang2,
          cacNgay: contract.cacNgay,
          giaiDoan: contract.giaiDoan,
          subGiaiDoan: contract.subGiaiDoan,
          thanhToan: {
            tongGiaTri: contract.thanhToan?.tongGiaTri || 0,
            tongGiaTriSauGiam: tongTien,
            khachHangDaThanhToan: daThanhToan,
            conLai,
            phanTramDaThanhToan: contract.thanhToan?.phanTramDaThanhToan || 0,
            trangThaiThanhToan: contract.thanhToan?.trangThaiThanhToan || 'Chưa thanh toán'
          },
          khachHangXacNhanAnh: contract.khachHangXacNhanAnh
        },
        album: album || null,
        paymentQr: {
          bankName,
          accountNumber,
          accountName,
          transferContent: cleanMa,
          sepayQrUrl
        }
      }
    });
  } catch (error) {
    console.error('Lỗi getPortalInfo:', error);
    return res.status(500).json({ status: 'error', message: 'Lỗi máy chủ khi tải cổng khách hàng' });
  }
};

// PR 4.2 (MOD-06): Normalized Pin Coordinate calculation & helpers
const normalizePinCoordinates = ({ coordinateX, coordinateY, normalizedX, normalizedY, originalWidth, originalHeight }) => {
  let normX = normalizedX;
  let normY = normalizedY;
  let coordX = coordinateX;
  let coordY = coordinateY;

  if (normX !== undefined && normX !== null && !isNaN(Number(normX))) {
    normX = Math.max(0, Math.min(1, Number(normX)));
    coordX = Math.round(normX * 10000) / 100;
  } else if (coordX !== undefined && coordX !== null && !isNaN(Number(coordX))) {
    coordX = Math.max(0, Math.min(100, Number(coordX)));
    normX = Math.round((coordX / 100) * 10000) / 10000;
  } else {
    normX = 0.5;
    coordX = 50;
  }

  if (normY !== undefined && normY !== null && !isNaN(Number(normY))) {
    normY = Math.max(0, Math.min(1, Number(normY)));
    coordY = Math.round(normY * 10000) / 100;
  } else if (coordY !== undefined && coordY !== null && !isNaN(Number(coordY))) {
    coordY = Math.max(0, Math.min(100, Number(coordY)));
    normY = Math.round((coordY / 100) * 10000) / 10000;
  } else {
    normY = 0.5;
    coordY = 50;
  }

  return {
    normalizedX: normX,
    normalizedY: normY,
    coordinateX: coordX,
    coordinateY: coordY,
    originalWidth: Number(originalWidth) || null,
    originalHeight: Number(originalHeight) || null
  };
};

const findAlbumByIdOrContract = async (idOrMaHopDong) => {
  if (!idOrMaHopDong) return null;
  const cleanStr = String(idOrMaHopDong).trim();
  const queries = [
    { maHopDong: { $regex: new RegExp(`^${cleanStr}$`, 'i') } }
  ];
  if (mongoose.isValidObjectId(cleanStr)) {
    queries.push({ _id: cleanStr });
  }
  return await ALBUM.findOne({ $or: queries });
};

const portalPhotoAction = async (req, res) => {
  try {
    const { maHopDong } = req.params;
    const {
      idDrive,
      action,
      isHearted,
      isCover,
      noiDung,
      note,
      coordinateX,
      coordinateY,
      normalizedX,
      normalizedY,
      originalWidth,
      originalHeight
    } = req.body;

    if (!maHopDong || !idDrive) {
      return res.status(400).json({ status: 'error', message: 'Thiếu mã hợp đồng hoặc idDrive' });
    }

    const album = await ALBUM.findOne({
      maHopDong: { $regex: new RegExp(`^${maHopDong.trim()}$`, 'i') }
    });
    if (!album) {
      return res.status(404).json({ status: 'error', message: 'Album chưa được đồng bộ trên hệ thống' });
    }

    let photo = album.danhSachAnh.find(p => p.idDrive === idDrive);
    if (!photo && album.danhSachAnhChinhSua) {
      photo = album.danhSachAnhChinhSua.find(p => p.idDrive === idDrive);
    }
    if (!photo) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy ảnh trong album' });
    }

    if (action === 'heart') {
      photo.isHearted = isHearted !== undefined ? Boolean(isHearted) : !photo.isHearted;
    } else if (action === 'cover') {
      photo.isCover = isCover !== undefined ? Boolean(isCover) : !photo.isCover;
      if (photo.isCover) photo.isHearted = true;
    } else if (action === 'comment' && (noiDung || note)) {
      const coords = normalizePinCoordinates({
        coordinateX,
        coordinateY,
        normalizedX,
        normalizedY,
        originalWidth,
        originalHeight
      });
      const noteText = String(noiDung || note).trim();
      const newComment = {
        noiDung: noteText,
        coordinateX: coords.coordinateX,
        coordinateY: coords.coordinateY,
        normalizedX: coords.normalizedX,
        normalizedY: coords.normalizedY,
        originalWidth: coords.originalWidth,
        originalHeight: coords.originalHeight,
        version: album.activeVersion || 1,
        author: req.user?.fullname || 'Khách hàng',
        ngayTao: new Date()
      };

      photo.comments = photo.comments || [];
      photo.comments.push(newComment);
      photo.isHearted = true;

      // Update active review version counter if exists
      if (!album.reviewVersions || album.reviewVersions.length === 0) {
        album.reviewVersions = [{
          version: 1,
          title: 'Bản chọn ảnh gốc v1',
          status: 'PENDING',
          submittedAt: album.createdAt || new Date(),
          submittedBy: 'Ekip Studio',
          retouchPinsCount: 1,
          photoSelectionsCount: (album.danhSachAnh || []).filter(p => p.isHearted).length,
          auditTrail: [{
            action: 'CREATED',
            actor: 'Ekip Studio',
            timestamp: new Date()
          }]
        }];
        album.activeVersion = 1;
      } else {
        const currentReview = album.reviewVersions.find(v => v.version === (album.activeVersion || 1));
        if (currentReview) {
          currentReview.retouchPinsCount = (currentReview.retouchPinsCount || 0) + 1;
        }
      }

      album.auditTrail = album.auditTrail || [];
      album.auditTrail.push({
        action: 'PIN_ADDED',
        actor: newComment.author,
        timestamp: new Date(),
        details: {
          photoId: photo.idDrive,
          version: album.activeVersion || 1,
          ...coords,
          noiDung: noteText
        }
      });
    }

    await album.save();
    return res.status(200).json({
      status: 'success',
      message: 'Đã lưu thao tác trên ảnh',
      photo
    });
  } catch (error) {
    console.error('Lỗi portalPhotoAction:', error);
    return res.status(500).json({ status: 'error', message: 'Lỗi máy chủ khi lưu thao tác ảnh' });
  }
};

const portalCompleteSelection = async (req, res) => {
  try {
    const { maHopDong } = req.params;
    const { ghiChuKhachHang } = req.body || {};

    const contract = await HOPDONG.findOne({
      maHopDong: { $regex: new RegExp(`^${maHopDong.trim()}$`, 'i') }
    });
    if (!contract) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy hợp đồng' });
    }

    const album = await ALBUM.findOne({ maHopDong: contract.maHopDong });
    let selectedFiles = [];
    if (album) {
      album.khachHangXacNhan = true;
      album.ngayKhachXacNhan = new Date();
      album.currentVersionApproved = true;

      selectedFiles = (album.danhSachAnh || [])
        .filter(p => p.isHearted)
        .map(p => p.tenFile || p.idDrive);

      const pinCount = (album.danhSachAnh || []).reduce((sum, p) => sum + (p.comments?.length || 0), 0);

      if (!album.reviewVersions || album.reviewVersions.length === 0) {
        album.reviewVersions = [{
          version: 1,
          title: 'Bản chọn ảnh gốc v1',
          status: 'APPROVED',
          submittedAt: album.createdAt || new Date(),
          submittedBy: 'Ekip Studio',
          approvedAt: new Date(),
          approvedBy: 'Khách hàng',
          approvalIp: req.ip || '127.0.0.1',
          clientNote: ghiChuKhachHang || '',
          photoSelectionsCount: selectedFiles.length,
          retouchPinsCount: pinCount,
          auditTrail: [{
            action: 'APPROVED',
            actor: 'Khách hàng',
            timestamp: new Date(),
            details: { note: ghiChuKhachHang }
          }]
        }];
        album.activeVersion = 1;
      } else {
        const currentReview = album.reviewVersions.find(v => v.version === (album.activeVersion || 1));
        if (currentReview) {
          currentReview.status = 'APPROVED';
          currentReview.approvedAt = new Date();
          currentReview.approvedBy = 'Khách hàng';
          currentReview.approvalIp = req.ip || '127.0.0.1';
          currentReview.clientNote = ghiChuKhachHang || currentReview.clientNote;
          currentReview.photoSelectionsCount = selectedFiles.length;
          currentReview.auditTrail = currentReview.auditTrail || [];
          currentReview.auditTrail.push({
            action: 'APPROVED',
            actor: 'Khách hàng',
            timestamp: new Date(),
            details: { note: ghiChuKhachHang }
          });
        }
      }

      album.auditTrail = album.auditTrail || [];
      album.auditTrail.push({
        action: 'REVIEW_APPROVED',
        actor: 'Khách hàng',
        timestamp: new Date(),
        details: { version: album.activeVersion || 1, note: ghiChuKhachHang }
      });

      await album.save();

      // Trigger Transactional Outbox for staff notification
      try {
        const NotificationOutbox = require('../models/notificationOutbox.model');
        const v = album.activeVersion || 1;
        await NotificationOutbox.create({
          maHopDong: contract.maHopDong,
          eventType: 'ALBUM_APPROVED',
          recipientType: 'STAFF',
          recipientGroup: 'Photoshop & In Ấn',
          payload: {
            albumId: album._id,
            maHopDong: contract.maHopDong,
            version: v,
            selectedCount: selectedFiles.length,
            clientNote: ghiChuKhachHang || ''
          },
          idempotencyKey: `ALBUM_APPROVED_${contract.maHopDong}_v${v}`
        });
      } catch (notifErr) {
        console.warn('[Album Outbox Warning]:', notifErr.message);
      }
    }

    const updateFields = {
      'khachHangXacNhanAnh.daXacNhan': true,
      'khachHangXacNhanAnh.thoiGianXacNhan': new Date(),
      'khachHangXacNhanAnh.ghiChuKhachHang': ghiChuKhachHang || `Khách đã chốt ${selectedFiles.length} ảnh qua Cổng Khách Hàng`
    };
    if (selectedFiles.length > 0) {
      updateFields['hauKy.danhSachMaAnhChon'] = selectedFiles;
    }

    await HOPDONG.updateOne({ _id: contract._id }, { $set: updateFields });

    return res.status(200).json({
      status: 'success',
      message: 'Đã gửi danh sách ảnh chốt thành công!',
      selectedCount: selectedFiles.length
    });
  } catch (error) {
    console.error('Lỗi portalCompleteSelection:', error);
    return res.status(500).json({ status: 'error', message: 'Lỗi máy chủ khi chốt danh sách ảnh' });
  }
};

// ==================== PR 4.2 DEDICATED V2 REVIEW & RETOUCH HANDLERS ====================

const addRetouchPin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      photoId,
      idDrive,
      normalizedX,
      normalizedY,
      coordinateX,
      coordinateY,
      originalWidth,
      originalHeight,
      note,
      noiDung
    } = req.body || {};

    const targetPhotoId = photoId || idDrive;
    if (!id || !targetPhotoId) {
      return res.status(400).json({ status: 'error', message: 'Thiếu mã hợp đồng/albumId hoặc photoId' });
    }

    const album = await findAlbumByIdOrContract(id);
    if (!album) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });
    }

    let photo = (album.danhSachAnh || []).find(p => p.idDrive === targetPhotoId || (p._id && p._id.toString() === targetPhotoId));
    if (!photo && album.danhSachAnhChinhSua) {
      photo = album.danhSachAnhChinhSua.find(p => p.idDrive === targetPhotoId || (p._id && p._id.toString() === targetPhotoId));
    }
    if (!photo) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy ảnh trong album' });
    }

    const coords = normalizePinCoordinates({ coordinateX, coordinateY, normalizedX, normalizedY, originalWidth, originalHeight });
    const noteContent = String(note || noiDung || '').trim();
    if (!noteContent) {
      return res.status(400).json({ status: 'error', message: 'Nội dung ghi chú không được để trống' });
    }

    const currentV = album.activeVersion || 1;
    const newComment = {
      noiDung: noteContent,
      coordinateX: coords.coordinateX,
      coordinateY: coords.coordinateY,
      normalizedX: coords.normalizedX,
      normalizedY: coords.normalizedY,
      originalWidth: coords.originalWidth,
      originalHeight: coords.originalHeight,
      version: currentV,
      author: req.user?.fullname || 'Khách hàng',
      ngayTao: new Date()
    };

    photo.comments = photo.comments || [];
    photo.comments.push(newComment);
    photo.isHearted = true;

    // Maintain reviewVersions summary
    if (!album.reviewVersions || album.reviewVersions.length === 0) {
      album.reviewVersions = [{
        version: 1,
        title: 'Bản chọn ảnh gốc v1',
        status: 'PENDING',
        submittedAt: album.createdAt || new Date(),
        submittedBy: 'Ekip Studio',
        retouchPinsCount: 1,
        photoSelectionsCount: (album.danhSachAnh || []).filter(p => p.isHearted).length,
        auditTrail: [{
          action: 'CREATED',
          actor: 'Ekip Studio',
          timestamp: new Date()
        }]
      }];
      album.activeVersion = 1;
    } else {
      const currentReview = album.reviewVersions.find(v => v.version === currentV);
      if (currentReview) {
        currentReview.retouchPinsCount = (currentReview.retouchPinsCount || 0) + 1;
      }
    }

    album.auditTrail = album.auditTrail || [];
    album.auditTrail.push({
      action: 'PIN_ADDED',
      actor: newComment.author,
      timestamp: new Date(),
      details: {
        photoId: photo.idDrive,
        version: currentV,
        ...coords,
        note: noteContent
      }
    });

    await album.save();

    return res.status(200).json({
      status: 'success',
      message: 'Đã thêm ghi chú ghim thành công',
      pin: newComment,
      photo
    });
  } catch (error) {
    console.error('Lỗi addRetouchPin:', error);
    return res.status(500).json({ status: 'error', message: 'Lỗi máy chủ khi thêm ghi chú ghim ảnh' });
  }
};

const approveAlbumReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { revisionVersion, note, customerConfirmation } = req.body || {};

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'Thiếu mã hợp đồng hoặc albumId' });
    }

    const album = await findAlbumByIdOrContract(id);
    if (!album) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });
    }

    const targetVersion = Number(revisionVersion) || album.activeVersion || 1;

    // Ensure reviewVersions array has active review
    if (!album.reviewVersions || album.reviewVersions.length === 0) {
      album.reviewVersions = [{
        version: 1,
        title: 'Bản chọn ảnh gốc v1',
        status: 'PENDING',
        submittedAt: album.createdAt || new Date(),
        submittedBy: 'Ekip Studio',
        retouchPinsCount: (album.danhSachAnh || []).reduce((sum, p) => sum + (p.comments?.length || 0), 0),
        photoSelectionsCount: (album.danhSachAnh || []).filter(p => p.isHearted).length,
        auditTrail: [{
          action: 'CREATED',
          actor: 'Ekip Studio',
          timestamp: new Date()
        }]
      }];
      album.activeVersion = 1;
    }

    let review = album.reviewVersions.find(v => v.version === targetVersion);
    if (!review) {
      review = {
        version: targetVersion,
        title: `Bản chỉnh sửa v${targetVersion}`,
        status: 'PENDING',
        submittedAt: new Date(),
        submittedBy: 'Ekip Studio',
        retouchPinsCount: 0,
        photoSelectionsCount: (album.danhSachAnh || []).filter(p => p.isHearted).length,
        auditTrail: []
      };
      album.reviewVersions.push(review);
    }

    // IDEMPOTENCY CHECK: if already approved, return early without duplicate logs/notifications
    if (review.status === 'APPROVED') {
      return res.status(200).json({
        status: 'success',
        message: `Phiên bản v${targetVersion} đã được duyệt trước đó`,
        alreadyApproved: true,
        activeVersion: album.activeVersion,
        review
      });
    }

    const actor = req.user?.fullname || req.portalClient?.maHopDong || 'Khách hàng';
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '127.0.0.1';

    review.status = 'APPROVED';
    review.approvedAt = new Date();
    review.approvedBy = actor;
    review.approvalIp = clientIp;
    review.clientNote = note || review.clientNote || '';
    review.auditTrail = review.auditTrail || [];
    review.auditTrail.push({
      action: 'APPROVED',
      actor,
      timestamp: new Date(),
      details: {
        version: targetVersion,
        note: review.clientNote,
        ip: clientIp
      }
    });

    if (targetVersion === (album.activeVersion || 1)) {
      album.currentVersionApproved = true;
      album.khachHangXacNhan = true;
      album.ngayKhachXacNhan = new Date();
    }

    album.auditTrail = album.auditTrail || [];
    album.auditTrail.push({
      action: 'REVIEW_APPROVED',
      actor,
      timestamp: new Date(),
      details: {
        version: targetVersion,
        note: review.clientNote,
        ip: clientIp
      }
    });

    await album.save();

    // Sync to HopDong
    await HOPDONG.updateOne(
      { maHopDong: album.maHopDong },
      {
        $set: {
          'khachHangXacNhanAnh.daXacNhan': true,
          'khachHangXacNhanAnh.thoiGianXacNhan': new Date(),
          'khachHangXacNhanAnh.ghiChuKhachHang': note || `Khách hàng đã duyệt hoàn tất album phiên bản v${targetVersion}`
        }
      }
    );

    // Enqueue Outbox notification
    try {
      const NotificationOutbox = require('../models/notificationOutbox.model');
      await NotificationOutbox.create({
        maHopDong: album.maHopDong,
        eventType: 'ALBUM_APPROVED',
        recipientType: 'STAFF',
        recipientGroup: 'Photoshop & In Ấn',
        payload: {
          albumId: album._id,
          maHopDong: album.maHopDong,
          version: targetVersion,
          clientNote: review.clientNote,
          approvedAt: review.approvedAt
        },
        idempotencyKey: `ALBUM_APPROVED_${album.maHopDong}_v${targetVersion}`
      });
    } catch (notifErr) {
      console.warn('[Album Outbox Warning]:', notifErr.message);
    }

    return res.status(200).json({
      status: 'success',
      message: `Đã duyệt thành công album phiên bản v${targetVersion}!`,
      activeVersion: album.activeVersion,
      review
    });
  } catch (error) {
    console.error('Lỗi approveAlbumReview:', error);
    return res.status(500).json({ status: 'error', message: 'Lỗi máy chủ khi duyệt album' });
  }
};

const uploadReviewVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, notes, photoList } = req.body || {};

    if (!id) {
      return res.status(400).json({ status: 'error', message: 'Thiếu mã hợp đồng hoặc albumId' });
    }

    const album = await findAlbumByIdOrContract(id);
    if (!album) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });
    }

    const currentV = album.activeVersion || 1;
    const nextVersion = currentV + 1;
    const actor = req.user?.fullname || req.user?.username || 'Ekip Photoshop';

    // CRITICAL (T-ALB02): New version MUST default to PENDING status and currentVersionApproved MUST be reset to false!
    const newVersionReview = {
      version: nextVersion,
      title: title || `Bản chỉnh sửa v${nextVersion}`,
      submittedAt: new Date(),
      submittedBy: actor,
      status: 'PENDING', // NEVER AUTOMATICALLY APPROVED!
      approvedAt: null,
      approvedBy: null,
      approvalIp: null,
      clientNote: '',
      changeRequestNotes: notes || '',
      photoSelectionsCount: (album.danhSachAnh || []).filter(p => p.isHearted).length,
      retouchPinsCount: 0,
      auditTrail: [{
        action: 'SUBMITTED',
        actor,
        timestamp: new Date(),
        details: { version: nextVersion, notes }
      }]
    };

    album.reviewVersions = album.reviewVersions || [];
    album.reviewVersions.push(newVersionReview);
    album.activeVersion = nextVersion;
    album.currentVersionApproved = false; // T-ALB02: MUST BE FALSE!
    album.khachHangXacNhan = false; // Reset client confirmation for new version

    if (Array.isArray(photoList) && photoList.length > 0) {
      album.danhSachAnhChinhSua = photoList;
      album.trangThaiChinhSua = 'Đã tải lên bản sửa';
    }

    album.auditTrail = album.auditTrail || [];
    album.auditTrail.push({
      action: 'VERSION_UPLOADED',
      actor,
      timestamp: new Date(),
      details: { version: nextVersion, notes }
    });

    await album.save();

    return res.status(201).json({
      status: 'success',
      message: `Đã tạo thành công phiên bản review v${nextVersion}! Chờ khách hàng duyệt.`,
      activeVersion: nextVersion,
      currentVersionApproved: false,
      version: newVersionReview
    });
  } catch (error) {
    console.error('Lỗi uploadReviewVersion:', error);
    return res.status(500).json({ status: 'error', message: 'Lỗi máy chủ khi tải lên phiên bản album mới' });
  }
};

const getReviewVersions = async (req, res) => {
  try {
    const { id } = req.params;
    const album = await findAlbumByIdOrContract(id);
    if (!album) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });
    }

    return res.status(200).json({
      status: 'success',
      activeVersion: album.activeVersion || 1,
      currentVersionApproved: Boolean(album.currentVersionApproved),
      reviewVersions: album.reviewVersions || [],
      auditTrail: album.auditTrail || []
    });
  } catch (error) {
    console.error('Lỗi getReviewVersions:', error);
    return res.status(500).json({ status: 'error', message: 'Lỗi máy chủ khi lấy danh sách phiên bản album' });
  }
};

const updateSelections = async (req, res) => {
  try {
    const { id } = req.params;
    const { photoId, idDrive, isHearted, isCover } = req.body || {};

    const targetPhotoId = photoId || idDrive;
    if (!id || !targetPhotoId) {
      return res.status(400).json({ status: 'error', message: 'Thiếu mã hợp đồng/albumId hoặc photoId' });
    }

    const album = await findAlbumByIdOrContract(id);
    if (!album) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });
    }

    let photo = (album.danhSachAnh || []).find(p => p.idDrive === targetPhotoId || (p._id && p._id.toString() === targetPhotoId));
    if (!photo && album.danhSachAnhChinhSua) {
      photo = album.danhSachAnhChinhSua.find(p => p.idDrive === targetPhotoId || (p._id && p._id.toString() === targetPhotoId));
    }
    if (!photo) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy ảnh trong album' });
    }

    if (isHearted !== undefined) {
      photo.isHearted = Boolean(isHearted);
    }
    if (isCover !== undefined) {
      photo.isCover = Boolean(isCover);
      if (photo.isCover) photo.isHearted = true;
    }

    // Update selections count on active review version
    if (album.reviewVersions && album.reviewVersions.length > 0) {
      const currentReview = album.reviewVersions.find(v => v.version === (album.activeVersion || 1));
      if (currentReview) {
        currentReview.photoSelectionsCount = (album.danhSachAnh || []).filter(p => p.isHearted).length;
      }
    }

    await album.save();

    return res.status(200).json({
      status: 'success',
      message: 'Đã cập nhật lựa chọn ảnh',
      photo
    });
  } catch (error) {
    console.error('Lỗi updateSelections:', error);
    return res.status(500).json({ status: 'error', message: 'Lỗi máy chủ khi cập nhật lựa chọn ảnh' });
  }
};

const generatePortalToken = async (req, res) => {
  try {
    const { maHopDong } = req.params;
    if (!maHopDong) {
      return res.status(400).json({ status: 'error', message: 'Thiếu mã hợp đồng' });
    }

    const contract = await HOPDONG.findOne({
      maHopDong: { $regex: new RegExp(`^${maHopDong.trim()}$`, 'i') }
    });
    if (!contract) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy hợp đồng' });
    }

    const token = jwt.sign(
      { maHopDong: contract.maHopDong, role: 'client_portal' },
      process.env.JWT_SECRET,
      { expiresIn: '60d' }
    );

    return res.status(200).json({
      status: 'success',
      data: {
        maHopDong: contract.maHopDong,
        token,
        expiresIn: 60 * 24 * 3600
      }
    });
  } catch (error) {
    console.error('Lỗi generatePortalToken:', error);
    return res.status(500).json({ status: 'error', message: 'Lỗi máy chủ khi tạo mã truy cập cổng' });
  }
};

module.exports = {
  syncDriveToAlbum,
  getAdminAlbums,
  getAdminAlbumDetail,
  getCustomerAlbum,
  heartImage,
  coverImage,
  commentImage,
  updateAlbumSettings,
  completeSelection,
  generateShareLink,
  getSharedAlbum,
  getSharedAlbumSeo,
  convertDriveToBase64,
  getPortalInfo,
  portalPhotoAction,
  portalCompleteSelection,
  generatePortalToken,
  // PR 4.2 additions
  normalizePinCoordinates,
  addRetouchPin,
  approveAlbumReview,
  uploadReviewVersion,
  getReviewVersions,
  updateSelections
};
