const TrangPhuc = require("../models/trangPhuc.model");
const HopDong = require("../models/hopDong.model");
const { success, error } = require("../utils/response");

async function list(req, res) {
  try {
    const { phanLoai, tinhTrang, keyword } = req.query || req.body;
    let query = {};
    if (phanLoai && phanLoai !== 'ALL') query.phanLoai = phanLoai;
    if (tinhTrang && tinhTrang !== 'ALL') query.tinhTrang = tinhTrang;
    if (keyword) {
      query.$or = [
        { maTrangPhuc: { $regex: keyword, $options: 'i' } },
        { tenTrangPhuc: { $regex: keyword, $options: 'i' } }
      ];
    }
    const items = await TrangPhuc.find(query).sort({ createdAt: -1 });
    return success(res, "Lấy danh sách trang phục thành công", items);
  } catch (err) {
    return error(res, err.message);
  }
}

async function getById(req, res) {
  try {
    const id = req.params.id || req.body.id;
    const item = await TrangPhuc.findById(id);
    if (!item) return error(res, "Không tìm thấy trang phục");
    return success(res, "Lấy thông tin trang phục thành công", item);
  } catch (err) {
    return error(res, err.message);
  }
}

async function create(req, res) {
  try {
    const { maTrangPhuc, tenTrangPhuc, phanLoai, size, mauSac, giaChoThue, giaCoc, anhDaiDien, viTriKe, ghiChu } = req.body;
    if (!maTrangPhuc || !tenTrangPhuc) {
      return error(res, "Mã và tên trang phục là bắt buộc");
    }
    const existing = await TrangPhuc.findOne({ maTrangPhuc: maTrangPhuc.toUpperCase().trim() });
    if (existing) {
      return error(res, "Mã trang phục này đã tồn tại trong kho!");
    }
    const item = new TrangPhuc({
      maTrangPhuc: maTrangPhuc.toUpperCase().trim(),
      tenTrangPhuc,
      phanLoai,
      size,
      mauSac,
      giaChoThue,
      giaCoc,
      anhDaiDien,
      viTriKe,
      ghiChu
    });
    await item.save();
    return success(res, "Thêm trang phục mới thành công", item);
  } catch (err) {
    return error(res, err.message);
  }
}

async function update(req, res) {
  try {
    const id = req.params.id || req.body._id || req.body.id;
    const updated = await TrangPhuc.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return error(res, "Không tìm thấy trang phục để cập nhật");
    return success(res, "Cập nhật trang phục thành công", updated);
  } catch (err) {
    return error(res, err.message);
  }
}

async function remove(req, res) {
  try {
    const id = req.params.id || req.body.id;
    const deleted = await TrangPhuc.findByIdAndDelete(id);
    if (!deleted) return error(res, "Không tìm thấy trang phục để xóa");
    return success(res, "Đã xóa trang phục thành công");
  } catch (err) {
    return error(res, err.message);
  }
}

// Kiểm tra xung đột lịch giữ/thuê váy/vest (Conflict Guard)
// Buffer mặc định: 1 ngày trước và 1 ngày sau để kịp giặt hấp / chuẩn bị
async function checkConflict(req, res) {
  try {
    const { maTrangPhuc, ngayHenLay, ngayHenTra, currentHopDongId } = req.body;
    if (!maTrangPhuc || !ngayHenLay || !ngayHenTra) {
      return error(res, "Vui lòng cung cấp mã trang phục, ngày hẹn lấy và ngày hẹn trả");
    }

    const start = new Date(ngayHenLay);
    const end = new Date(ngayHenTra);

    // Mở rộng khoảng kiểm tra buffer 1 ngày giặt hấp
    const bufferBefore = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const bufferAfter = new Date(end.getTime() + 24 * 60 * 60 * 1000);

    const query = {
      "trangPhucGiu.maTrangPhuc": maTrangPhuc.toUpperCase().trim(),
      "trangPhucGiu.trangThai": { $in: ['GIU_CHO', 'DANG_MUON'] }
    };

    if (currentHopDongId) {
      query._id = { $ne: currentHopDongId };
    }

    const conflictingContracts = await HopDong.find(query).populate('khachHang1', 'tenKhachHang soDienThoai');

    const conflicts = [];
    for (const hd of conflictingContracts) {
      for (const item of (hd.trangPhucGiu || [])) {
        if (item.maTrangPhuc === maTrangPhuc.toUpperCase().trim() && ['GIU_CHO', 'DANG_MUON'].includes(item.trangThai)) {
          const itemStart = new Date(item.ngayHenLay);
          const itemEnd = new Date(item.ngayHenTra);

          // Kiểm tra giao thoa khoảng thời gian
          if (itemStart <= bufferAfter && itemEnd >= bufferBefore) {
            conflicts.push({
              maHopDong: hd.maHopDong,
              tenKhachHang: hd.khachHang1?.tenKhachHang || "Khách hàng",
              soDienThoai: hd.khachHang1?.soDienThoai || "",
              ngayHenLay: item.ngayHenLay,
              ngayHenTra: item.ngayHenTra,
              trangThai: item.trangThai
            });
          }
        }
      }
    }

    return success(res, "Kiểm tra lịch trùng khớp hoàn tất", {
      isConflict: conflicts.length > 0,
      conflicts
    });
  } catch (err) {
    return error(res, err.message);
  }
}

// Lấy lịch giữ đồ tổng thể cho FullCalendar / Dashboard
async function getBookingCalendar(req, res) {
  try {
    const contracts = await HopDong.find({
      "trangPhucGiu.0": { $exists: true }
    }).populate('khachHang1', 'tenKhachHang soDienThoai');

    const events = [];
    for (const hd of contracts) {
      for (const item of (hd.trangPhucGiu || [])) {
        if (item.ngayHenLay && item.ngayHenTra && item.trangThai !== 'HUY') {
          events.push({
            id: `${hd._id}_${item.maTrangPhuc}`,
            title: `[${item.maTrangPhuc}] ${item.tenTrangPhuc || ''} - ${hd.khachHang1?.tenKhachHang || ''}`,
            start: item.ngayHenLay,
            end: item.ngayHenTra,
            maHopDong: hd.maHopDong,
            maTrangPhuc: item.maTrangPhuc,
            tenKhach: hd.khachHang1?.tenKhachHang,
            sdt: hd.khachHang1?.soDienThoai,
            trangThai: item.trangThai,
            color: item.trangThai === 'DANG_MUON' ? '#dc2626' : '#2563eb'
          });
        }
      }
    }

    return success(res, "Lấy lịch giữ đồ thành công", events);
  } catch (err) {
    return error(res, err.message);
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  checkConflict,
  getBookingCalendar
};
