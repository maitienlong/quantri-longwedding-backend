const Lead = require("../models/lead.model");
const KhachHang = require("../models/khachHang.model");
const HopDong = require("../models/hopDong.model");
const { success, error } = require("../utils/response");

async function list(req, res) {
  try {
    const { trangThai, salePhuTrach, keyword } = req.query || req.body;
    let query = {};
    if (trangThai && trangThai !== 'ALL') query.trangThai = trangThai;
    if (salePhuTrach && salePhuTrach !== 'ALL') query.salePhuTrach = salePhuTrach;
    if (keyword) {
      query.$or = [
        { maLead: { $regex: keyword, $options: 'i' } },
        { hoTen: { $regex: keyword, $options: 'i' } },
        { soDienThoai: { $regex: keyword, $options: 'i' } },
        { facebookName: { $regex: keyword, $options: 'i' } }
      ];
    }
    const items = await Lead.find(query).sort({ createdAt: -1 });
    return success(res, "Lấy danh sách Lead thành công", items);
  } catch (err) {
    return error(res, err.message);
  }
}

async function create(req, res) {
  try {
    const { hoTen, soDienThoai, facebookId, facebookName, zaloId, nguonLead, ngayCuoiDuKien, goiQuanTam, nganSachDuKien, salePhuTrach, ghiChu } = req.body;
    if (!hoTen) {
      return error(res, "Họ tên khách hàng tiềm năng là bắt buộc");
    }

    const maLead = 'LEAD-' + Date.now().toString().slice(-6);

    const lead = new Lead({
      maLead,
      hoTen,
      soDienThoai,
      facebookId,
      facebookName,
      zaloId,
      nguonLead: nguonLead || 'MESSENGER',
      ngayCuoiDuKien,
      goiQuanTam,
      nganSachDuKien: nganSachDuKien || 0,
      salePhuTrach: salePhuTrach || req.user?.fullname || "",
      ghiChu,
      trangThai: 'MOI',
      lichSuTuVan: [{
        noiDung: "Thu nhận Lead từ " + (nguonLead || 'Messenger'),
        nguoiGhi: req.user?.fullname || "Hệ thống / n8n",
        thoiGian: new Date()
      }]
    });

    await lead.save();
    return success(res, "Thu nhận Lead thành công", lead);
  } catch (err) {
    return error(res, err.message);
  }
}

async function update(req, res) {
  try {
    const id = req.params.id || req.body._id || req.body.id;
    const { consultationNote, ...rest } = req.body;
    
    let updateQuery = { ...rest };
    if (consultationNote) {
      updateQuery.$push = {
        lichSuTuVan: {
          noiDung: consultationNote,
          nguoiGhi: req.user?.fullname || "Sale",
          thoiGian: new Date()
        }
      };
    }

    const updated = await Lead.findByIdAndUpdate(id, updateQuery, { new: true });
    if (!updated) return error(res, "Không tìm thấy Lead để cập nhật");
    return success(res, "Cập nhật Lead thành công", updated);
  } catch (err) {
    return error(res, err.message);
  }
}

// Chuyển đổi Lead thành Hợp Đồng chính thức khi khách cọc
async function convertToContract(req, res) {
  try {
    const { leadId, maHopDong, contractType, khachHangData, gioHang, thanhToan, cacNgay, nguoiPhucVu } = req.body;
    const lead = await Lead.findById(leadId);
    if (!lead) return error(res, "Không tìm thấy Lead tương ứng");

    // 1. Tạo hoặc lấy khách hàng
    let khId = null;
    if (lead.soDienThoai) {
      const existingKH = await KhachHang.findOne({ soDienThoai: lead.soDienThoai });
      if (existingKH) khId = existingKH._id;
    }
    if (!khId) {
      const newKH = new KhachHang({
        tenKhachHang: khachHangData?.tenKhachHang || lead.hoTen,
        soDienThoai: khachHangData?.soDienThoai || lead.soDienThoai || "",
        diaChi: khachHangData?.diaChi || "",
        facebookId: lead.facebookId || ""
      });
      await newKH.save();
      khId = newKH._id;
    }

    // 2. Tạo Hợp đồng chính thức
    const newContract = new HopDong({
      maHopDong: maHopDong || ('HD-' + Date.now().toString().slice(-6)),
      contractType: contractType || 'FULL_WEDDING',
      ngayHopDong: new Date(),
      khachHang1: khId,
      gioHang: gioHang || [],
      thanhToan: thanhToan || {},
      cacNgay: cacNgay || {},
      nguoiPhucVu: nguoiPhucVu || { banHang: lead.salePhuTrach || req.user?.fullname || "" },
      giaiDoan: 1,
      subGiaiDoan: 'dang_thuc_hien'
    });

    await newContract.save();

    // 3. Đánh dấu Lead thành DA_CHOT (Won)
    lead.trangThai = 'DA_CHOT';
    lead.hopDongId = newContract._id;
    lead.maHopDongChuyenDoi = newContract.maHopDong;
    lead.ngayChuyenDoi = new Date();
    lead.lichSuTuVan.push({
      noiDung: "Chuyển đổi thành công sang Hợp đồng " + (newContract.maHopDong || ""),
      nguoiGhi: req.user?.fullname || "Sale",
      thoiGian: new Date()
    });
    await lead.save();

    return success(res, "Chuyển đổi Lead sang Hợp đồng thành công", {
      lead,
      hopDong: newContract
    });
  } catch (err) {
    return error(res, err.message);
  }
}

module.exports = {
  list,
  create,
  update,
  convertToContract
};
