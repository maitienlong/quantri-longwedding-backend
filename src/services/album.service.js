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

// Middleware xử lý
const syncDriveToAlbum = async (req, res) => {
  try {
    const { maHopDong, driveLink, loaiAnh = 'goc' } = req.body;
    if (!maHopDong || !driveLink) {
      return res.status(400).json({ status: 'error', message: 'Thiếu thông tin maHopDong hoặc driveLink' });
    }

    const isGooglePhotos = driveLink.includes('photos.app.goo.gl') || driveLink.includes('photos.google.com');
    let folderIdOrLink = driveLink;

    if (!isGooglePhotos) {
      // Extract folder ID from link
      const match = driveLink.match(/folders\/([a-zA-Z0-9-_]+)/);
      folderIdOrLink = match ? match[1] : driveLink;

      if (!process.env.APPS_SCRIPT_URL) {
        return res.status(500).json({ status: 'error', message: 'Chưa cấu hình APPS_SCRIPT_URL trong .env' });
      }
    }

    // Tạo publicLink ngẫu nhiên
    const publicLink = crypto.randomBytes(8).toString('hex');

    // Tìm hoặc tạo album mới
    let album = await ALBUM.findOne({ maHopDong });
    if (!album) {
      album = new ALBUM({ maHopDong, driveLink, publicLink, trangThai: 'Đang xử lý', danhSachAnh: [] });
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

    // Đợi xử lý đồng bộ xong do luồng mới rất nhanh
    await processImagesInBackground(album._id, folderIdOrLink, loaiAnh);

    // Lấy lại album sau khi đã đồng bộ xong
    const updatedAlbum = await ALBUM.findById(album._id);

    return res.status(200).json({ status: 'success', message: 'Đã đồng bộ xong ảnh từ Google.', album: updatedAlbum });

  } catch (error) {
    console.error("Error syncDriveToAlbum:", error);
    return res.status(500).json({ status: 'error', message: 'Lỗi server khi đồng bộ' });
  }
};

const processImagesInBackground = async (albumId, folderIdOrLink, loaiAnh) => {
  try {
    const album = await ALBUM.findById(albumId);
    if (!album) return;

    let files = [];
    const isGooglePhotos = folderIdOrLink.includes('photos.app.goo.gl') || folderIdOrLink.includes('photos.google.com');

    if (isGooglePhotos) {
      // Fetch Google Photos shared album
      const response = await axios.get(folderIdOrLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      });
      const html = response.data;
      // Trích xuất toàn bộ URL chứa /pw/ (Public Web của Google Photos)
      const regex = /https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9\-_]+/g;
      const matches = html.match(regex) || [];
      const uniqueUrls = [...new Set(matches)];
      const photoUrls = uniqueUrls.filter(url => url.length > 50);

      // Trích xuất tên file nguyên bản từ HTML (các chuỗi kết thúc bằng .ext nằm trong dấu nháy kép và không chứa đường dẫn)
      const filenameRegex = /"([^"\/\\#\?]+\.(?:jpg|jpeg|png|heic|heif|gif|JPG|JPEG|PNG|HEIC|HEIF|GIF))"/g;
      const filenames = [];
      let fMatch;
      while ((fMatch = filenameRegex.exec(html)) !== null) {
        filenames.push(fMatch[1]);
      }

      files = photoUrls.map((url, index) => ({
        id: url.split('/').pop(),
        name: filenames[index] || `Photo_${index + 1}.jpg`,
        urlGoc: `${url}=s0`,
        urlNen: `${url}=w1000`
      }));
    } else {
      // Call Google Apps Script to get list of files
      const scriptUrl = process.env.APPS_SCRIPT_URL;
      const response = await axios.get(`${scriptUrl}?folderId=${folderIdOrLink}`);
      
      if (response.data.status !== 'success') {
        console.error("Apps Script Error:", response.data.message);
        if (loaiAnh === 'goc') album.trangThai = 'Lỗi đồng bộ';
        else album.trangThaiChinhSua = 'Lỗi đồng bộ';
        await album.save();
        return;
      }

      const driveFiles = response.data.data || [];
      files = driveFiles.map(file => ({
        id: file.id,
        name: file.name,
        urlGoc: `https://drive.google.com/uc?id=${file.id}`,
        urlNen: `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`
      }));
    }

    if (files.length === 0) {
      if (loaiAnh === 'goc') {
        album.danhSachAnh = [];
        album.trangThai = 'Hoàn thành';
      } else {
        album.danhSachAnhChinhSua = [];
        album.trangThaiChinhSua = 'Hoàn thành';
      }
      await album.save();
      return;
    }

    const existingPhotosMap = new Map();
    const currentList = loaiAnh === 'goc' ? (album.danhSachAnh || []) : (album.danhSachAnhChinhSua || []);
    currentList.forEach(p => {
      if (p.idDrive) existingPhotosMap.set(p.idDrive, p);
      if (p.tenFile) existingPhotosMap.set(p.tenFile, p);
    });

    const newPhotos = [];

    for (let file of files) {
      try {
        const existing = existingPhotosMap.get(file.id) || existingPhotosMap.get(file.name);
        newPhotos.push({
          idDrive: file.id,
          tenFile: file.name,
          urlGoc: file.urlGoc,
          urlNen: file.urlNen,
          isHearted: existing ? Boolean(existing.isHearted) : false,
          comments: existing ? (existing.comments || []) : []
        });

      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
      }
    }

    if (loaiAnh === 'goc') {
      album.danhSachAnh = newPhotos;
      album.trangThai = 'Hoàn thành';
    } else {
      album.danhSachAnhChinhSua = newPhotos;
      album.trangThaiChinhSua = 'Hoàn thành';
    }
    
    await album.save();

  } catch (error) {
    console.error("Lỗi processImagesInBackground:", error);
    try {
      const album = await ALBUM.findById(albumId);
      if (album) {
        if (loaiAnh === 'goc') album.trangThai = 'Lỗi đồng bộ';
        else album.trangThaiChinhSua = 'Lỗi đồng bộ';
        await album.save();
      }
    } catch(e) {}
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
        const publicLink = crypto.randomBytes(8).toString('hex');
        const shareLink = crypto.randomBytes(6).toString('hex');
        album = new ALBUM({ maHopDong, driveLink, publicLink, shareLink, trangThai: 'Đang xử lý', danhSachAnh: [] });
        await album.save();

        processImagesInBackground(album._id, driveLink, loaiAnh).catch(err => console.error("Lỗi auto sync background:", err));
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
