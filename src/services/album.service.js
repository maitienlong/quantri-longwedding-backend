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

    // Extract folder ID from link
    // Extract folder ID from link
    const match = driveLink.match(/folders\/([a-zA-Z0-9-_]+)/);
    const folderId = match ? match[1] : driveLink;

    if (!process.env.APPS_SCRIPT_URL) {
      return res.status(500).json({ status: 'error', message: 'Chưa cấu hình APPS_SCRIPT_URL trong .env' });
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

    // Đợi xử lý đồng bộ xong do luồng mới rất nhanh
    await processImagesInBackground(album._id, folderId, loaiAnh);

    // Lấy lại album sau khi đã đồng bộ xong
    const updatedAlbum = await ALBUM.findById(album._id);

    return res.status(200).json({ status: 'success', message: 'Đã đồng bộ xong ảnh từ Google Drive.', album: updatedAlbum });

  } catch (error) {
    console.error("Error syncDriveToAlbum:", error);
    return res.status(500).json({ status: 'error', message: 'Lỗi server khi đồng bộ' });
  }
};

const processImagesInBackground = async (albumId, folderId, loaiAnh) => {
  try {
    const album = await ALBUM.findById(albumId);
    if (!album) return;

    // Call Google Apps Script to get list of files
    const scriptUrl = process.env.APPS_SCRIPT_URL;
    const response = await axios.get(`${scriptUrl}?folderId=${folderId}`);
    
    if (response.data.status !== 'success') {
      console.error("Apps Script Error:", response.data.message);
      if (loaiAnh === 'goc') album.trangThai = 'Lỗi đồng bộ';
      else album.trangThaiChinhSua = 'Lỗi đồng bộ';
      await album.save();
      return;
    }

    const files = response.data.data;
    if (!files || files.length === 0) {
      if (loaiAnh === 'goc') album.trangThai = 'Hoàn thành';
      else album.trangThaiChinhSua = 'Hoàn thành';
      await album.save();
      return;
    }

    const newPhotos = [];
    const targetArray = loaiAnh === 'goc' ? album.danhSachAnh : album.danhSachAnhChinhSua;

    for (let file of files) {
      // Check if file already exists in album
      const existing = targetArray.find(a => a.idDrive === file.id);
      if (existing) continue;

      try {
        const urlGoc = `https://drive.google.com/uc?id=${file.id}`;
        const urlNen = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`;

        newPhotos.push({
          idDrive: file.id,
          tenFile: file.name,
          urlGoc: urlGoc,
          urlNen: urlNen,
          isHearted: false,
          comments: []
        });

      } catch (err) {
        console.error(`Error processing file ${file.name}:`, err);
      }
    }

    if (newPhotos.length > 0) {
      if (loaiAnh === 'goc') {
        album.danhSachAnh.push(...newPhotos);
      } else {
        album.danhSachAnhChinhSua.push(...newPhotos);
      }
    }
    
    if (loaiAnh === 'goc') album.trangThai = 'Hoàn thành';
    else album.trangThaiChinhSua = 'Hoàn thành';
    
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
    const album = await ALBUM.findOne({ maHopDong });
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
    const { coGioiHanAnh, soLuongAnhGioiHan, khachHangXacNhan } = req.body;
    
    const album = await ALBUM.findOne({ maHopDong });
    if (!album) return res.status(404).json({ status: 'error', message: 'Không tìm thấy album' });

    if (coGioiHanAnh !== undefined) album.coGioiHanAnh = coGioiHanAnh;
    if (soLuongAnhGioiHan !== undefined) album.soLuongAnhGioiHan = soLuongAnhGioiHan;
    if (khachHangXacNhan !== undefined) album.khachHangXacNhan = khachHangXacNhan;

    await album.save();
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
    
    // Chỉ trả về ảnh đã chỉnh sửa
    return res.status(200).json({ 
      status: 'success', 
      album: {
        danhSachAnhChinhSua: album.danhSachAnhChinhSua,
        maHopDong: album.maHopDong
      } 
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Lỗi server' });
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
  getSharedAlbum
};
