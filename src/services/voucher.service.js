const Voucher = require("../models/voucher.model");
const HopDong = require("../models/hopDong.model");
const KhachHang = require("../models/khachHang.model");
const { success, error } = require("../utils/response");
const { createLog } = require("../utils/logger");

// Helper sinh chuỗi ngẫu nhiên ký tự dễ đọc (không chứa ký tự dễ nhầm 0, O, 1, I)
function generateRandomSuffix(len = 4) {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let str = "";
  for (let i = 0; i < len; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

/**
 * Lấy danh sách Voucher kèm bộ lọc & thống kê
 */
async function findAll(req, res) {
  try {
    const { keyword, status, discountType } = req.body || {};

    let query = {};

    // 1. Tìm kiếm theo keyword (code hoặc title hoặc mã con)
    if (keyword && typeof keyword === 'string' && keyword.trim()) {
      const kw = keyword.trim();
      query.$or = [
        { code: { $regex: kw, $options: "i" } },
        { title: { $regex: kw, $options: "i" } },
        { description: { $regex: kw, $options: "i" } },
        { "generatedCodes.code": { $regex: kw, $options: "i" } }
      ];
    }

    // 2. Lọc theo loại giảm giá
    if (discountType !== undefined && discountType !== null && discountType !== '' && discountType !== 'all') {
      query.discountType = Number(discountType);
    }

    const now = new Date();

    // 3. Lọc theo trạng thái
    if (status === 'active') {
      query.isActive = true;
      query.$and = [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
        { $or: [{ usageLimit: null }, { usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] }
      ];
    } else if (status === 'inactive') {
      query.isActive = false;
    } else if (status === 'expired') {
      query.endDate = { $lt: now };
    } else if (status === 'exhausted') {
      query.usageLimit = { $gt: 0 };
      query.$expr = { $gte: ["$usedCount", "$usageLimit"] };
    }

    const vouchers = await Voucher.find(query).sort({ createdAt: -1 });

    // Tính toán thống kê tổng quan
    const allVouchers = await Voucher.find({});
    let totalActive = 0;
    let totalUsedCount = 0;
    let totalDiscountAmount = 0;
    let totalGeneratedCodes = 0;

    allVouchers.forEach(v => {
      const subUsed = Array.isArray(v.generatedCodes) ? v.generatedCodes.filter(c => c.isUsed).length : 0;
      const histUsed = Array.isArray(v.usageHistory) ? v.usageHistory.length : 0;
      const actualUsed = Math.max(subUsed, histUsed);
      totalUsedCount += actualUsed;
      if (Array.isArray(v.generatedCodes)) {
        totalGeneratedCodes += v.generatedCodes.length;
      }
      if (Array.isArray(v.usageHistory)) {
        totalDiscountAmount += v.usageHistory.reduce((sum, h) => sum + (h.giamGiaAmount || 0), 0);
      }
      const isTimeValid = (!v.startDate || new Date(v.startDate) <= now) && (!v.endDate || new Date(v.endDate) >= now);
      const isLimitValid = !v.usageLimit || v.usageLimit === 0 || (v.usedCount || 0) < v.usageLimit;
      if (v.isActive && isTimeValid && isLimitValid) {
        totalActive += 1;
      }
    });

    const vouchersFormatted = vouchers.map(v => {
      const vObj = typeof v.toObject === 'function' ? v.toObject() : { ...v };
      const subUsed = Array.isArray(vObj.generatedCodes) ? vObj.generatedCodes.filter(c => c.isUsed).length : 0;
      const histUsed = Array.isArray(vObj.usageHistory) ? vObj.usageHistory.length : 0;
      vObj.usedCount = Math.max(subUsed, histUsed);
      return vObj;
    });

    return success(res, "Lấy danh sách voucher thành công", {
      vouchers: vouchersFormatted,
      stats: {
        total: allVouchers.length,
        active: totalActive,
        totalUsedCount,
        totalDiscountAmount,
        totalGeneratedCodes
      }
    });
  } catch (err) {
    console.error("Lỗi khi lấy danh sách voucher:", err);
    return error(res, err.message);
  }
}

/**
 * Lấy chi tiết Voucher kèm lịch sử sử dụng
 */
async function getById(req, res) {
  try {
    const { id } = req.params;
    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return error(res, "Không tìm thấy voucher");
    }
    return success(res, "Lấy thông tin voucher thành công", voucher);
  } catch (err) {
    return error(res, err.message);
  }
}

/**
 * Tạo mới Voucher
 */
async function create(req, res) {
  try {
    let {
      code,
      title,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minOrderValue,
      usageLimit,
      usageLimitPerCustomer,
      startDate,
      endDate,
      isActive,
      applicableContractTypes,
      winningRate,
      initialBatchCount // Tùy chọn sinh sẵn X mã code con
    } = req.body;

    if (!code || !code.trim()) {
      return error(res, "Mã Voucher không được để trống");
    }
    if (!title || !title.trim()) {
      return error(res, "Tên chương trình ưu đãi không được để trống");
    }
    if (discountValue === undefined || discountValue === null || Number(discountValue) < 0) {
      return error(res, "Giá trị giảm không hợp lệ");
    }

    code = code.trim().toUpperCase().replace(/\s+/g, '');

    // Kiểm tra trùng mã gốc
    const existing = await Voucher.findOne({ code });
    if (existing) {
      return error(res, `Mã voucher "${code}" đã tồn tại trên hệ thống!`);
    }

    const createdBy = req.user?.fullname || req.user?.username || "Quản trị viên";

    const newVoucher = new Voucher({
      code,
      title: title.trim(),
      description: (description || "").trim(),
      discountType: Number(discountType) === 1 ? 1 : 0,
      discountValue: Number(discountValue) || 0,
      maxDiscount: Number(maxDiscount) || 0,
      minOrderValue: Number(minOrderValue) || 0,
      usageLimit: null, // Không giới hạn tổng lượt dùng
      usageLimitPerCustomer: Number(usageLimitPerCustomer) >= 1 ? Number(usageLimitPerCustomer) : 1,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      applicableContractTypes: Array.isArray(applicableContractTypes) ? applicableContractTypes : [],
      winningRate: winningRate !== undefined && winningRate !== null && winningRate !== '' ? Math.max(0, Math.min(100, Number(winningRate))) : 50,
      generatedCodes: [],
      createdBy
    });

    await newVoucher.save();

    await createLog({
      action: "Tạo Voucher",
      req,
      details: { code, title, discountType, discountValue, winningRate: newVoucher.winningRate }
    });

    return success(res, "Tạo voucher mới thành công", newVoucher);
  } catch (err) {
    console.error("Lỗi khi tạo voucher:", err);
    return error(res, err.message);
  }
}

/**
 * Cập nhật Voucher
 */
async function update(req, res) {
  try {
    const { id } = req.params;
    let {
      code,
      title,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minOrderValue,
      usageLimitPerCustomer,
      startDate,
      endDate,
      isActive,
      applicableContractTypes,
      winningRate
    } = req.body;

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return error(res, "Không tìm thấy voucher cần cập nhật");
    }

    if (code) {
      code = code.trim().toUpperCase().replace(/\s+/g, '');
      if (code !== voucher.code) {
        const duplicate = await Voucher.findOne({ code, _id: { $ne: id } });
        if (duplicate) {
          return error(res, `Mã voucher "${code}" đã được sử dụng bởi chương trình khác!`);
        }
        voucher.code = code;
      }
    }

    if (title) voucher.title = title.trim();
    if (description !== undefined) voucher.description = (description || "").trim();
    if (discountType !== undefined) voucher.discountType = Number(discountType) === 1 ? 1 : 0;
    if (discountValue !== undefined) voucher.discountValue = Number(discountValue) || 0;
    if (maxDiscount !== undefined) voucher.maxDiscount = Number(maxDiscount) || 0;
    if (minOrderValue !== undefined) voucher.minOrderValue = Number(minOrderValue) || 0;
    voucher.usageLimit = null; // Không giới hạn tổng lượt dùng

    if (usageLimitPerCustomer !== undefined) voucher.usageLimitPerCustomer = Number(usageLimitPerCustomer) || 1;
    if (startDate !== undefined) voucher.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) voucher.endDate = endDate ? new Date(endDate) : null;
    if (isActive !== undefined) voucher.isActive = Boolean(isActive);
    if (applicableContractTypes !== undefined) voucher.applicableContractTypes = Array.isArray(applicableContractTypes) ? applicableContractTypes : [];
    if (winningRate !== undefined) voucher.winningRate = Math.max(0, Math.min(100, Number(winningRate) || 0));

    await voucher.save();

    await createLog({
      action: "Cập nhật Voucher",
      req,
      details: { id, code: voucher.code, title: voucher.title }
    });

    return success(res, "Cập nhật voucher thành công", voucher);
  } catch (err) {
    console.error("Lỗi khi cập nhật voucher:", err);
    return error(res, err.message);
  }
}

/**
 * Xóa Voucher
 */
async function remove(req, res) {
  try {
    const { id } = req.params;
    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return error(res, "Không tìm thấy voucher");
    }

    if (voucher.usedCount > 0) {
      return error(res, "Không thể xóa voucher đã có lượt sử dụng. Vui lòng chuyển trạng thái sang Tạm dừng.");
    }

    await Voucher.findByIdAndDelete(id);

    await createLog({
      action: "Xóa Voucher",
      req,
      details: { id, code: voucher.code }
    });

    return success(res, `Đã xóa voucher "${voucher.code}" thành công`);
  } catch (err) {
    return error(res, err.message);
  }
}

/**
 * Bật/Tắt trạng thái hoạt động Voucher
 */
async function toggleStatus(req, res) {
  try {
    const { id } = req.params;
    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return error(res, "Không tìm thấy voucher");
    }

    voucher.isActive = !voucher.isActive;
    await voucher.save();

    await createLog({
      action: "Đổi trạng thái Voucher",
      req,
      details: { id, code: voucher.code, isActive: voucher.isActive }
    });

    return success(res, `Đã ${voucher.isActive ? "kích hoạt" : "tạm dừng"} voucher "${voucher.code}"`, voucher);
  } catch (err) {
    return error(res, err.message);
  }
}

/**
 * Sinh nhiều mã code con (Batch Generate Codes) cho 1 chương trình
 */
async function generateBatchCodes(req, res) {
  try {
    const { id } = req.params;
    const { quantity = 10, prefix, codeLength = 4, autoIncreaseLimit = true } = req.body;

    const count = Math.min(Math.max(1, Number(quantity) || 10), 1000);
    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return error(res, "Không tìm thấy chương trình Voucher!");
    }

    const cleanPrefix = (prefix && typeof prefix === 'string' && prefix.trim())
      ? prefix.trim().toUpperCase().replace(/\s+/g, '')
      : voucher.code;

    if (!voucher.generatedCodes) {
      voucher.generatedCodes = [];
    }

    const existingCodeSet = new Set(voucher.generatedCodes.map(c => c.code.toUpperCase()));
    const newGenerated = [];

    let attempts = 0;
    const maxAttempts = count * 20;

    while (newGenerated.length < count && attempts < maxAttempts) {
      attempts++;
      const randSuffix = generateRandomSuffix(Number(codeLength) || 4);
      const fullCode = `${cleanPrefix}-${randSuffix}`;

      if (!existingCodeSet.has(fullCode)) {
        existingCodeSet.add(fullCode);
        const codeObj = {
          code: fullCode,
          isClaimed: false,
          claimedName: "",
          claimedPhone: "",
          claimedAt: null,
          isUsed: false,
          usedAt: null,
          usedContract: "",
          createdAt: new Date()
        };
        newGenerated.push(codeObj);
        voucher.generatedCodes.push(codeObj);
      }
    }

    // Tùy chọn tự động nâng giới hạn số lượt dùng của chương trình theo số mã mới sinh
    if (autoIncreaseLimit) {
      if (voucher.usageLimit) {
        voucher.usageLimit = Math.max(voucher.usageLimit, voucher.generatedCodes.length);
      }
    }

    voucher.markModified('generatedCodes');
    await voucher.save();

    await createLog({
      action: "Sinh mã Voucher hàng loạt",
      req,
      details: { id, programCode: voucher.code, generatedCount: newGenerated.length, totalCodes: voucher.generatedCodes.length }
    });

    return success(res, `Đã sinh thành công ${newGenerated.length} mã code độc nhất cho chương trình "${voucher.title}"`, {
      voucherId: voucher._id,
      programCode: voucher.code,
      generatedCount: newGenerated.length,
      totalCodes: voucher.generatedCodes.length,
      newCodes: newGenerated
    });
  } catch (err) {
    console.error("Lỗi khi sinh mã code hàng loạt:", err);
    return error(res, err.message);
  }
}

/**
 * Lấy danh sách toàn bộ các mã code con của 1 chương trình
 */
async function getGeneratedCodes(req, res) {
  try {
    const { id } = req.params;
    const { status = 'all', keyword = '' } = req.query || {};

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return error(res, "Không tìm thấy chương trình Voucher!");
    }

    let list = Array.isArray(voucher.generatedCodes) 
      ? voucher.generatedCodes.map(c => (typeof c.toObject === 'function' ? c.toObject() : { ...c })) 
      : [];

    // Nếu voucher có lịch sử sử dụng (usageHistory), bổ sung các bản ghi chưa có trong subcodes
    if (Array.isArray(voucher.usageHistory) && voucher.usageHistory.length > 0) {
      const existingUsedContracts = new Set(list.filter(c => c.isUsed && c.usedContract).map(c => c.usedContract));
      voucher.usageHistory.forEach(h => {
        if (!h.maHopDong || !existingUsedContracts.has(h.maHopDong)) {
          list.push({
            _id: h._id || ('history_' + Math.random()),
            code: voucher.code,
            isClaimed: true,
            claimedName: h.tenKhachHang || '',
            claimedPhone: h.soDienThoai || '',
            claimedAt: h.usedAt,
            isUsed: true,
            usedAt: h.usedAt,
            usedContract: h.maHopDong,
            giamGiaAmount: h.giamGiaAmount,
            isMainCodeUsage: true
          });
        }
      });
    }

    // Filter theo status
    if (status === 'available') {
      list = list.filter(c => !c.isClaimed && !c.isUsed);
    } else if (status === 'claimed') {
      list = list.filter(c => c.isClaimed && !c.isUsed);
    } else if (status === 'used') {
      list = list.filter(c => c.isUsed);
    }

    // Filter theo keyword (mã, tên, sđt, hợp đồng)
    if (keyword && typeof keyword === 'string' && keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(c => 
        (c.code && c.code.toLowerCase().includes(kw)) ||
        (c.claimedName && c.claimedName.toLowerCase().includes(kw)) ||
        (c.claimedPhone && c.claimedPhone.toLowerCase().includes(kw)) ||
        (c.usedContract && c.usedContract.toLowerCase().includes(kw))
      );
    }

    const allCodes = Array.isArray(voucher.generatedCodes) ? voucher.generatedCodes : [];
    const usedSubCodesCount = allCodes.filter(c => c.isUsed).length;
    const historyCount = Array.isArray(voucher.usageHistory) ? voucher.usageHistory.length : 0;
    const actualUsedCount = Math.max(usedSubCodesCount, historyCount);

    if (voucher.usedCount !== actualUsedCount) {
      voucher.usedCount = actualUsedCount;
      try { await voucher.save(); } catch (e) {}
    }

    const stats = {
      total: allCodes.length,
      available: allCodes.filter(c => !c.isClaimed && !c.isUsed).length,
      claimed: allCodes.filter(c => c.isClaimed && !c.isUsed).length,
      used: actualUsedCount
    };

    return success(res, "Lấy danh sách mã code con thành công", {
      voucher: {
        _id: voucher._id,
        code: voucher.code,
        title: voucher.title,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        minOrderValue: voucher.minOrderValue,
        maxDiscount: voucher.maxDiscount,
        isActive: voucher.isActive,
        usageHistory: voucher.usageHistory || []
      },
      stats,
      codes: list
    });
  } catch (err) {
    return error(res, err.message);
  }
}

/**
 * Xóa 1 mã code con chưa sử dụng
 */
async function deleteGeneratedCode(req, res) {
  try {
    const { id, codeId } = req.params;
    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return error(res, "Không tìm thấy chương trình Voucher!");
    }

    const item = voucher.generatedCodes?.id(codeId);
    if (!item) {
      return error(res, "Không tìm thấy mã code cần xóa!");
    }

    if (item.isUsed) {
      return error(res, "Không thể xóa mã code đã được sử dụng trong hợp đồng!");
    }

    voucher.generatedCodes.pull({ _id: codeId });
    voucher.markModified('generatedCodes');
    await voucher.save();

    return success(res, `Đã xóa mã code "${item.code}" thành công`);
  } catch (err) {
    return error(res, err.message);
  }
}

/**
 * Kiểm tra & Tính toán Voucher hợp lệ cho đơn hàng / hợp đồng
 */
async function validateVoucher(req, res) {
  try {
    let { code, orderTotal, khachHangId, soDienThoai, dichVuChinh } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return error(res, "Vui lòng nhập mã Voucher");
    }

    code = code.trim().toUpperCase().replace(/\s+/g, '');
    
    // Tìm theo mã gốc hoặc mã con trong generatedCodes
    let voucher = await Voucher.findOne({
      $or: [
        { code },
        { "generatedCodes.code": code }
      ]
    });

    if (!voucher) {
      return error(res, `Mã Voucher "${code}" không tồn tại trên hệ thống`);
    }

    // Nếu là mã con, kiểm tra trạng thái riêng của mã con đó
    let matchedSubCode = null;
    if (Array.isArray(voucher.generatedCodes)) {
      matchedSubCode = voucher.generatedCodes.find(c => c.code.toUpperCase() === code);
    }

    if (matchedSubCode) {
      if (matchedSubCode.isUsed) {
        return error(res, `Mã code "${code}" đã được sử dụng vào hợp đồng ${matchedSubCode.usedContract || ''} ngày ${matchedSubCode.usedAt ? new Date(matchedSubCode.usedAt).toLocaleDateString('vi-VN') : ''}`);
      }
    }

    // 1. Kiểm tra trạng thái hoạt động của chương trình
    if (!voucher.isActive) {
      return error(res, `Chương trình ưu đãi "${voucher.title}" hiện đang tạm ngừng áp dụng`);
    }

    const now = new Date();

    // 2. Kiểm tra ngày bắt đầu
    if (voucher.startDate && new Date(voucher.startDate) > now) {
      const startDateStr = new Date(voucher.startDate).toLocaleDateString('vi-VN');
      return error(res, `Voucher "${code}" chỉ có hiệu lực từ ngày ${startDateStr}`);
    }

    // 3. Kiểm tra ngày hết hạn
    if (voucher.endDate && new Date(voucher.endDate) < now) {
      const endDateStr = new Date(voucher.endDate).toLocaleDateString('vi-VN');
      return error(res, `Voucher "${code}" đã hết hạn sử dụng vào ngày ${endDateStr}`);
    }

    // 4. Kiểm tra tổng số lượt sử dụng
    if (!matchedSubCode && voucher.usageLimit && voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
      return error(res, `Chương trình "${voucher.title}" đã hết lượt sử dụng (đã dùng ${voucher.usedCount}/${voucher.usageLimit})`);
    }

    // 5. Kiểm tra lượt dùng của khách hàng nếu có thông tin khách hàng
    if (khachHangId || soDienThoai) {
      const maxPerCust = voucher.usageLimitPerCustomer || 1;
      let customerUses = 0;
      if (Array.isArray(voucher.usageHistory)) {
        customerUses = voucher.usageHistory.filter(h => 
          (khachHangId && h.khachHangId && h.khachHangId.toString() === khachHangId.toString()) ||
          (soDienThoai && h.soDienThoai && h.soDienThoai.trim() === soDienThoai.trim())
        ).length;
      }

      if (customerUses >= maxPerCust) {
        return error(res, `Khách hàng này đã sử dụng ưu đãi "${voucher.title}" (${customerUses}/${maxPerCust} lần cho phép)`);
      }
    }

    // 6. Kiểm tra loại hợp đồng áp dụng
    if (Array.isArray(voucher.applicableContractTypes) && voucher.applicableContractTypes.length > 0) {
      if (dichVuChinh !== undefined && dichVuChinh !== null && !voucher.applicableContractTypes.includes(Number(dichVuChinh))) {
        return error(res, `Voucher "${code}" không áp dụng cho gói/loại hợp đồng này`);
      }
    }

    // 7. Kiểm tra giá trị đơn hàng tối thiểu
    const total = Number(orderTotal) || 0;
    if (voucher.minOrderValue && total < voucher.minOrderValue) {
      return error(res, `Voucher "${code}" yêu cầu giá trị đơn hàng tối thiểu từ ${voucher.minOrderValue.toLocaleString('vi-VN')} đ (Hiện tại: ${total.toLocaleString('vi-VN')} đ)`);
    }

    // 8. Tính số tiền giảm giá chính xác
    let discountAmount = 0;
    if (voucher.discountType === 1) {
      // Phần trăm
      discountAmount = (total * voucher.discountValue) / 100;
      if (voucher.maxDiscount && voucher.maxDiscount > 0 && discountAmount > voucher.maxDiscount) {
        discountAmount = voucher.maxDiscount;
      }
    } else {
      // Số tiền cố định
      discountAmount = voucher.discountValue;
    }

    // Đảm bảo không giảm quá tổng tiền
    discountAmount = Math.min(total, Math.round(discountAmount));
    const finalTotal = Math.max(0, total - discountAmount);

    return success(res, `Áp dụng mã Voucher "${code}" thành công`, {
      voucher: {
        _id: voucher._id,
        code: voucher.code,
        appliedCode: code,
        isSubCode: Boolean(matchedSubCode),
        title: voucher.title,
        description: voucher.description,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        maxDiscount: voucher.maxDiscount,
        minOrderValue: voucher.minOrderValue
      },
      discountAmount,
      finalTotal
    });
  } catch (err) {
    console.error("Lỗi khi kiểm tra voucher:", err);
    return error(res, err.message);
  }
}

/**
 * Ghi nhận sử dụng voucher (được gọi nội bộ từ hopDong.service.js)
 */
async function recordUsage({ voucherCode, voucherId, hopDongId, maHopDong, khachHangId, tenKhachHang, soDienThoai, giamGiaAmount }) {
  try {
    let voucher = null;
    const cleanCode = voucherCode ? voucherCode.trim().toUpperCase() : null;

    if (voucherId) {
      voucher = await Voucher.findById(voucherId);
    } else if (cleanCode) {
      voucher = await Voucher.findOne({
        $or: [
          { code: cleanCode },
          { "generatedCodes.code": cleanCode }
        ]
      });
    }

    if (!voucher) return null;

    voucher.usedCount = (voucher.usedCount || 0) + 1;
    if (!voucher.usageHistory) voucher.usageHistory = [];

    // Nếu mã được dùng là một mã con trong generatedCodes, đánh dấu đã dùng
    if (cleanCode && Array.isArray(voucher.generatedCodes)) {
      const subCode = voucher.generatedCodes.find(c => c.code.toUpperCase() === cleanCode);
      if (subCode) {
        subCode.isUsed = true;
        subCode.usedAt = new Date();
        subCode.usedContract = maHopDong;
        voucher.markModified('generatedCodes');
      }
    }

    voucher.usageHistory.push({
      hopDongId,
      maHopDong,
      khachHangId,
      tenKhachHang: tenKhachHang || "",
      soDienThoai: soDienThoai || "",
      giamGiaAmount: Number(giamGiaAmount) || 0,
      usedAt: new Date()
    });

    await voucher.save();
    return voucher;
  } catch (err) {
    console.error("Lỗi ghi nhận sử dụng voucher:", err);
    return null;
  }
}

/**
 * Hoàn lại lượt dùng voucher khi hủy / xóa hợp đồng
 */
async function revertUsage({ hopDongId, maHopDong }) {
  try {
    const voucher = await Voucher.findOne({
      $or: [
        { "usageHistory.maHopDong": maHopDong },
        { "generatedCodes.usedContract": maHopDong }
      ]
    });

    if (!voucher) return null;

    voucher.usageHistory = voucher.usageHistory.filter(h => h.maHopDong !== maHopDong && (!hopDongId || h.hopDongId?.toString() !== hopDongId.toString()));
    voucher.usedCount = Math.max(0, (voucher.usedCount || 1) - 1);

    if (Array.isArray(voucher.generatedCodes)) {
      const subCode = voucher.generatedCodes.find(c => c.usedContract === maHopDong);
      if (subCode) {
        subCode.isUsed = false;
        subCode.usedAt = null;
        subCode.usedContract = "";
        voucher.markModified('generatedCodes');
      }
    }

    await voucher.save();
    return voucher;
  } catch (err) {
    console.error("Lỗi hoàn lại lượt dùng voucher:", err);
    return null;
  }
}

module.exports = {
  findAll,
  getById,
  create,
  update,
  remove,
  toggleStatus,
  generateBatchCodes,
  getGeneratedCodes,
  deleteGeneratedCode,
  validateVoucher,
  recordUsage,
  revertUsage
};
