const Lead = require("../models/lead.model");
const KhachHang = require("../models/khachHang.model");
const HopDong = require("../models/hopDong.model");
const { success, error } = require("../utils/response");
const { normalizePhoneNumber } = require("../utils/phoneUtils");

async function list(req, res) {
  try {
    const { trangThai, salePhuTrach, keyword } = req.query || req.body || {};
    let query = {};
    if (trangThai && trangThai !== 'ALL') query.trangThai = trangThai;
    if (salePhuTrach && salePhuTrach !== 'ALL') query.salePhuTrach = salePhuTrach;
    if (keyword) {
      const cleanKw = keyword.trim();
      const normKw = normalizePhoneNumber(cleanKw);
      query.$or = [
        { maLead: { $regex: cleanKw, $options: 'i' } },
        { hoTen: { $regex: cleanKw, $options: 'i' } },
        { soDienThoai: { $regex: cleanKw, $options: 'i' } },
        ...(normKw ? [{ normalizedPhone: { $regex: normKw, $options: 'i' } }] : []),
        { facebookName: { $regex: cleanKw, $options: 'i' } }
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
    const { hoTen, soDienThoai, facebookId, facebookName, zaloId, nguonLead, ngayCuoiDuKien, goiQuanTam, nganSachDuKien, salePhuTrach, ghiChu, dichVuChinh } = req.body;
    if (!hoTen || !hoTen.trim()) {
      return error(res, "Họ tên khách hàng tiềm năng là bắt buộc", 400);
    }

    const maLead = 'LEAD-' + Date.now().toString().slice(-6);
    const cleanPhone = normalizePhoneNumber(soDienThoai);

    // Tìm xem khách hàng đã tồn tại trong CRM chưa
    let existingKH = null;
    if (cleanPhone) {
      existingKH = await KhachHang.findOne({
        $or: [
          { normalizedPhone: cleanPhone },
          { soDienThoai: cleanPhone },
          { soDienThoai: soDienThoai }
        ]
      });
    }

    const lead = new Lead({
      maLead,
      hoTen: hoTen.trim(),
      soDienThoai: soDienThoai || "",
      normalizedPhone: cleanPhone,
      facebookId: facebookId || "",
      facebookName: facebookName || "",
      zaloId: zaloId || "",
      nguonLead: nguonLead || 'MESSENGER',
      ngayCuoiDuKien: ngayCuoiDuKien ? new Date(ngayCuoiDuKien) : undefined,
      dichVuChinh: Number(dichVuChinh) || 1,
      goiQuanTam: goiQuanTam || "",
      nganSachDuKien: Math.max(0, Number(nganSachDuKien) || 0),
      salePhuTrach: salePhuTrach || req.user?.fullname || req.user?.username || "",
      ghiChu: ghiChu || "",
      trangThai: 'MOI',
      khachHangId: existingKH ? existingKH._id : undefined,
      lichSuTuVan: [{
        noiDung: "Thu nhận Lead từ " + (nguonLead || 'Messenger'),
        nguoiGhi: req.user?.fullname || req.user?.username || "Hệ thống / n8n",
        thoiGian: new Date()
      }]
    });

    await lead.save();
    return success(res, "Thu nhận Lead thành công", lead);
  } catch (err) {
    return error(res, err.message);
  }
}

async function webhookCreate(req, res) {
  const configuredSecret = process.env.LEAD_WEBHOOK_SECRET;
  if (configuredSecret) {
    const incomingSecret = req.headers?.['x-webhook-secret'] || req.headers?.['x-api-key'] || req.query?.secret;
    if (!incomingSecret || incomingSecret !== configuredSecret) {
      return error(res, "Xác thực webhook không hợp lệ (Unauthorized)", 401);
    }
  }
  return create(req, res);
}

async function update(req, res) {
  try {
    const id = req.params.id || req.body._id || req.body.id;
    const { consultationNote, ...rest } = req.body;

    let updateQuery = { ...rest };
    if (updateQuery.soDienThoai) {
      updateQuery.normalizedPhone = normalizePhoneNumber(updateQuery.soDienThoai);
    }

    if (consultationNote && consultationNote.trim()) {
      updateQuery.$push = {
        lichSuTuVan: {
          noiDung: consultationNote.trim(),
          nguoiGhi: req.user?.fullname || req.user?.username || "Sale",
          thoiGian: new Date()
        }
      };
    }

    const updated = await Lead.findByIdAndUpdate(id, updateQuery, { new: true });
    if (!updated) return error(res, "Không tìm thấy Lead để cập nhật", 404);
    return success(res, "Cập nhật Lead thành công", updated);
  } catch (err) {
    return error(res, err.message);
  }
}

// Chuyển đổi Lead thành Hợp Đồng chính thức khi khách cọc (Idempotent & Multi-Service support)
async function convertToContract(req, res) {
  try {
    const {
      leadId,
      maHopDong,
      contractType,
      dichVuChinh,
      khachHangData,
      gioHang,
      thanhToan,
      cacNgay,
      nguoiPhucVu
    } = req.body;

    const lead = await Lead.findById(leadId);
    if (!lead) return error(res, "Không tìm thấy Lead tương ứng", 404);

    // 1. Kiểm tra tính lũy đẳng (Idempotency Guard / Chống double-click tạo 2 hợp đồng)
    if (lead.trangThai === 'DA_CHOT' && lead.hopDongId) {
      let existingContract = null;
      try {
        existingContract = await HopDong.findById(lead.hopDongId);
      } catch (e) {}
      if (!existingContract && lead.maHopDongChuyenDoi) {
        existingContract = await HopDong.findOne({ maHopDong: lead.maHopDongChuyenDoi });
      }

      if (existingContract) {
        return success(res, `Lead [${lead.maLead}] đã được chuyển đổi thành Hợp đồng ${existingContract.maHopDong} trước đó!`, {
          lead,
          hopDong: existingContract,
          isAlreadyConverted: true
        });
      }
    }

    if (['HUY', 'KHONG_TIEM_NANG'].includes(lead.trangThai)) {
      return error(res, `Không thể chuyển đổi Lead có trạng thái "${lead.trangThai}"!`, 400);
    }

    // 2. Chuẩn hóa số điện thoại và tìm/tạo Khách hàng (Chống trùng khách hàng)
    const rawPhone = (khachHangData?.soDienThoai || lead.soDienThoai || "").trim();
    const cleanPhone = normalizePhoneNumber(rawPhone);

    let khId = null;
    let existingKH = null;

    if (cleanPhone) {
      existingKH = await KhachHang.findOne({
        $or: [
          { normalizedPhone: cleanPhone },
          { soDienThoai: cleanPhone },
          { soDienThoai: rawPhone }
        ]
      });
    }

    if (!existingKH && lead.facebookId) {
      existingKH = await KhachHang.findOne({ facebookId: lead.facebookId });
    }

    if (existingKH) {
      khId = existingKH._id;
      // Cập nhật số điện thoại chuẩn nếu chưa có
      if (!existingKH.normalizedPhone && cleanPhone) {
        existingKH.normalizedPhone = cleanPhone;
        await existingKH.save();
      }
    } else {
      const newKH = new KhachHang({
        tenKhachHang: (khachHangData?.tenKhachHang || lead.hoTen || "Khách hàng").trim(),
        soDienThoai: rawPhone,
        normalizedPhone: cleanPhone,
        diaChi: khachHangData?.diaChi || "Chưa cập nhật",
        facebookId: lead.facebookId || ""
      });
      await newKH.save();
      khId = newKH._id;
    }

    // 3. Xác định loại dịch vụ chính (DichVuChinh Mapping)
    const selectedDichVuChinh = Number(dichVuChinh) || Number(lead.dichVuChinh) || 1;

    // 4. Tạo Hợp đồng chính thức
    const finalMaHopDong = maHopDong || ('HD-' + Date.now().toString().slice(-6));
    const finalNgayCuoi = cacNgay?.ngayCuoi || lead.ngayCuoiDuKien;

    const newContract = new HopDong({
      maHopDong: finalMaHopDong,
      contractType: contractType || 'FULL_WEDDING',
      dichVuChinh: selectedDichVuChinh,
      ngayHopDong: new Date(),
      khachHang1: khId,
      gioHang: gioHang || [],
      thanhToan: thanhToan || {},
      cacNgay: {
        ...(cacNgay || {}),
        ...(finalNgayCuoi ? { ngayCuoi: finalNgayCuoi } : {})
      },
      nguoiPhucVu: nguoiPhucVu || { banHang: lead.salePhuTrach || req.user?.fullname || req.user?.username || "" },
      giaiDoan: 1,
      subGiaiDoan: 'dang_thuc_hien',
      auditLog: [{
        action: "Chuyển đổi từ Lead",
        reason: `Khởi tạo hợp đồng từ Lead ${lead.maLead} (${lead.hoTen})`,
        performedBy: req.user?.fullname || req.user?.username || "Sale",
        role: req.user?.positon || req.user?.role || "Sale",
        timestamp: new Date()
      }]
    });

    await newContract.save();

    // 5. Cập nhật Lead thành DA_CHOT (Won)
    lead.trangThai = 'DA_CHOT';
    lead.hopDongId = newContract._id;
    lead.maHopDongChuyenDoi = newContract.maHopDong;
    lead.ngayChuyenDoi = new Date();
    lead.khachHangId = khId;
    lead.lichSuTuVan.push({
      noiDung: `Chuyển đổi thành công sang Hợp đồng ${newContract.maHopDong} (Gói: ${selectedDichVuChinh})`,
      nguoiGhi: req.user?.fullname || req.user?.username || "Sale",
      thoiGian: new Date()
    });
    await lead.save();

    return success(res, `Chuyển đổi Lead sang Hợp đồng ${newContract.maHopDong} thành công`, {
      lead,
      hopDong: newContract,
      isAlreadyConverted: false
    });
  } catch (err) {
    return error(res, err.message);
  }
}

/**
 * Gộp hai hồ sơ khách hàng trùng lặp (Customer Merge - Non-destructive)
 */
async function mergeCustomers(req, res) {
  try {
    const { masterCustomerId, duplicateCustomerId, previewOnly = false } = req.body;

    if (!masterCustomerId || !duplicateCustomerId) {
      return error(res, "Cần cung cấp cả masterCustomerId và duplicateCustomerId!", 400);
    }

    if (String(masterCustomerId) === String(duplicateCustomerId)) {
      return error(res, "Không thể gộp một khách hàng vào chính họ!", 400);
    }

    const master = await KhachHang.findById(masterCustomerId);
    const duplicate = await KhachHang.findById(duplicateCustomerId);

    if (!master || !duplicate) {
      return error(res, "Không tìm thấy một trong hai khách hàng cần gộp!", 404);
    }

    if (duplicate.isMerged) {
      return error(res, `Khách hàng [${duplicate.tenKhachHang}] đã được gộp vào hồ sơ khác trước đó!`, 400);
    }

    // Tìm các Hợp đồng liên quan đến khách hàng trùng
    const affectedContracts = await HopDong.find({
      $or: [
        { khachHang1: duplicate._id },
        { khachHang2: duplicate._id }
      ]
    });

    // Tìm các Lead liên quan
    const affectedLeads = await Lead.find({
      $or: [
        { khachHangId: duplicate._id },
        { soDienThoai: duplicate.soDienThoai },
        ...(duplicate.normalizedPhone ? [{ normalizedPhone: duplicate.normalizedPhone }] : [])
      ]
    });

    if (previewOnly) {
      return success(res, "Xem trước kết quả gộp khách hàng", {
        master: { id: master._id, tenKhachHang: master.tenKhachHang, soDienThoai: master.soDienThoai },
        duplicate: { id: duplicate._id, tenKhachHang: duplicate.tenKhachHang, soDienThoai: duplicate.soDienThoai },
        contractsCount: affectedContracts.length,
        contracts: affectedContracts.map(c => ({ id: c._id, maHopDong: c.maHopDong })),
        leadsCount: affectedLeads.length,
        leads: affectedLeads.map(l => ({ id: l._id, maLead: l.maLead, hoTen: l.hoTen }))
      });
    }

    // 1. Chuyển quyền sở hữu toàn bộ hợp đồng sang master
    for (const c of affectedContracts) {
      const updateFields = {};
      if (String(c.khachHang1) === String(duplicate._id)) {
        updateFields.khachHang1 = master._id;
      }
      if (String(c.khachHang2) === String(duplicate._id)) {
        updateFields.khachHang2 = master._id;
      }

      if (!c.auditLog) c.auditLog = [];
      const auditEntry = {
        action: "Gộp khách hàng",
        reason: `Chuyển chủ hợp đồng từ [${duplicate.tenKhachHang}] sang [${master.tenKhachHang}] do gộp tài khoản`,
        performedBy: req.user?.fullname || req.user?.username || "Admin",
        role: req.user?.positon || req.user?.role || "Admin",
        timestamp: new Date()
      };

      await HopDong.updateOne({ _id: c._id }, {
        $set: updateFields,
        $push: { auditLog: auditEntry }
      });
    }

    // 2. Chuyển toàn bộ Lead sang master
    if (affectedLeads.length > 0) {
      await Lead.updateMany(
        { _id: { $in: affectedLeads.map(l => l._id) } },
        { $set: { khachHangId: master._id } }
      );
    }

    // 3. Sao lưu thông tin từ duplicate sang master nếu master còn thiếu
    const masterUpdates = {};
    if ((!master.diaChi || master.diaChi === "Chưa cập nhật") && duplicate.diaChi && duplicate.diaChi !== "Chưa cập nhật") {
      masterUpdates.diaChi = duplicate.diaChi;
    }
    if (!master.facebookId && duplicate.facebookId) {
      masterUpdates.facebookId = duplicate.facebookId;
    }
    if (Object.keys(masterUpdates).length > 0) {
      await KhachHang.updateOne({ _id: master._id }, { $set: masterUpdates });
    }

    // 4. Đánh dấu duplicate là đã gộp (Soft-merge, không xóa bản ghi)
    duplicate.isMerged = true;
    duplicate.mergedInto = master._id;
    await duplicate.save();

    return success(res, `Đã gộp thành công khách hàng [${duplicate.tenKhachHang}] vào [${master.tenKhachHang}]`, {
      masterId: master._id,
      duplicateId: duplicate._id,
      reassignedContracts: affectedContracts.length,
      reassignedLeads: affectedLeads.length
    });

  } catch (err) {
    return error(res, err.message);
  }
}

module.exports = {
  list,
  create,
  webhookCreate,
  update,
  convertToContract,
  mergeCustomers
};
