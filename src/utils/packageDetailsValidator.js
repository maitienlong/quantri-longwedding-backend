/**
 * Validator và bộ đồng bộ hai chiều cho Thông số Chi tiết Gói Dịch vụ (Schema v2)
 * Đảm bảo:
 * - Server-side validation: chặn số âm, khổ = 0, kiểu dữ liệu sai (AC-09)
 * - Idempotency và tương thích 100% với các trường legacy
 * - Tự động tính toán tổng số lượt chụp, makeup, số lượng ảnh các kích thước chuẩn
 */

function validateAndProcessPackageDetails(rawDetails, legacyFallback = {}) {
  if (!rawDetails || typeof rawDetails !== 'object' || Object.keys(rawDetails).length === 0) {
    return {
      isValid: true,
      details: null,
      schemaVersion: 1,
      legacyFields: {
        soLuongLichChup: Number(legacyFallback.soLuongLichChup) || 0,
        soLuongLichMake: Number(legacyFallback.soLuongLichMake) || 0,
        soLuongAnhChinhSua: Number(legacyFallback.soLuongAnhChinhSua) || 0,
        soLuongAnh16x21: Number(legacyFallback.soLuongAnh16x21) || 0,
        soLuongAnh20x30: Number(legacyFallback.soLuongAnh20x30) || 0,
        soLuongAnh60x90: Number(legacyFallback.soLuongAnh60x90) || 0,
        trangDiemNgayAnHoi: legacyFallback.trangDiemNgayAnHoi || "",
        trangDiemNgayCuoi: legacyFallback.trangDiemNgayCuoi || "",
        trangPhucChoDoiBeLe: legacyFallback.trangPhucChoDoiBeLe || "",
        trangPhucCoDauNgayAnHoi: legacyFallback.trangPhucCoDauNgayAnHoi || "",
        trangPhucChuReNgayAnHoi: legacyFallback.trangPhucChuReNgayAnHoi || "",
        trangPhucVayCuoiNgayCuoi: legacyFallback.trangPhucVayCuoiNgayCuoi || "",
        trangPhucVestChuReNgayCuoi: legacyFallback.trangPhucVestChuReNgayCuoi || "",
        hoaCamTay: legacyFallback.hoaCamTay || ""
      }
    };
  }

  const errors = [];
  const details = {
    photoRetouch: {
      editedFileCount: 0,
      rawFileStatus: 'unset',
      deliveryDays: 0,
      note: ''
    },
    photoSchedules: [],
    deliverables: [],
    makeupSessions: [],
    wardrobe: [],
    extras: [],
    terms: []
  };

  // 1. Photo Retouch & Files
  if (rawDetails.photoRetouch) {
    const pr = rawDetails.photoRetouch;
    const count = Number(pr.editedFileCount);
    if (isNaN(count) || count < 0 || !Number.isInteger(count)) {
      errors.push("Số file ảnh chỉnh sửa phải là số nguyên không âm");
    } else {
      details.photoRetouch.editedFileCount = count;
    }

    const st = String(pr.rawFileStatus || 'unset').toLowerCase();
    details.photoRetouch.rawFileStatus = ['included', 'excluded', 'unset'].includes(st) ? st : 'unset';
    details.photoRetouch.deliveryDays = Math.max(0, Number(pr.deliveryDays) || 0);
    details.photoRetouch.note = String(pr.note || '').trim();
  }

  // 2. Photo Schedules (Lịch chụp & nhân sự)
  if (Array.isArray(rawDetails.photoSchedules)) {
    rawDetails.photoSchedules.forEach((sch, index) => {
      const sess = Number(sch.sessionCount);
      if (isNaN(sess) || sess < 0 || !Number.isInteger(sess)) {
        errors.push(`Lịch chụp dòng ${index + 1}: Số buổi phải là số nguyên không âm`);
      }
      details.photoSchedules.push({
        id: sch.id || `sch_${Date.now()}_${index}`,
        occasion: String(sch.occasion || 'studio').trim(),
        sessionCount: Math.max(0, Number(sess) || 0),
        dayCount: Math.max(0, Number(sch.dayCount) || 0),
        location: String(sch.location || '').trim(),
        staff: String(sch.staff || '').trim(),
        note: String(sch.note || '').trim()
      });
    });
  }

  // 3. Deliverables (Sản phẩm bàn giao)
  if (Array.isArray(rawDetails.deliverables)) {
    rawDetails.deliverables.forEach((del, index) => {
      const w = Number(del.widthCm);
      const h = Number(del.heightCm);
      const q = Number(del.quantity);

      if (isNaN(w) || w <= 0) {
        errors.push(`Sản phẩm bàn giao dòng ${index + 1}: Chiều rộng (${del.widthCm}) phải lớn hơn 0`);
      }
      if (isNaN(h) || h <= 0) {
        errors.push(`Sản phẩm bàn giao dòng ${index + 1}: Chiều cao (${del.heightCm}) phải lớn hơn 0`);
      }
      if (isNaN(q) || q < 0 || !Number.isInteger(q)) {
        errors.push(`Sản phẩm bàn giao dòng ${index + 1}: Số lượng phải là số nguyên không âm`);
      }

      details.deliverables.push({
        id: del.id || `del_${Date.now()}_${index}`,
        kind: String(del.kind || 'photo_print').trim(),
        name: String(del.name || '').trim(),
        widthCm: Math.max(1, Math.round(w) || 1),
        heightCm: Math.max(1, Math.round(h) || 1),
        quantity: Math.max(0, Math.round(q) || 0),
        material: String(del.material || '').trim(),
        note: String(del.note || '').trim(),
        sortOrder: Number(del.sortOrder) || index + 1
      });
    });
  }

  // 4. Makeup Sessions (Lịch trang điểm)
  if (Array.isArray(rawDetails.makeupSessions)) {
    rawDetails.makeupSessions.forEach((mk, index) => {
      const sess = Number(mk.sessionCount);
      if (isNaN(sess) || sess < 0 || !Number.isInteger(sess)) {
        errors.push(`Makeup dòng ${index + 1}: Số lượt phải là số nguyên không âm`);
      }
      details.makeupSessions.push({
        id: mk.id || `mk_${Date.now()}_${index}`,
        occasion: String(mk.occasion || 'unspecified').trim(),
        recipient: String(mk.recipient || 'bride').trim(),
        sessionCount: Math.max(0, Number(sess) || 0),
        location: String(mk.location || '').trim(),
        note: String(mk.note || '').trim()
      });
    });
  }

  // 5. Wardrobe (Trang phục & phụ kiện)
  if (Array.isArray(rawDetails.wardrobe)) {
    rawDetails.wardrobe.forEach((wd, index) => {
      const q = Number(wd.quantity);
      const maxVal = Number(wd.maxValueVnd);
      if (isNaN(q) || q < 0 || !Number.isInteger(q)) {
        errors.push(`Trang phục dòng ${index + 1}: Số lượng phải là số nguyên không âm`);
      }
      if (isNaN(maxVal) || maxVal < 0) {
        errors.push(`Trang phục dòng ${index + 1}: Giá trị tối đa không được âm`);
      }
      details.wardrobe.push({
        id: wd.id || `wd_${Date.now()}_${index}`,
        occasion: String(wd.occasion || '').trim(),
        recipient: String(wd.recipient || '').trim(),
        itemType: String(wd.itemType || '').trim(),
        quantity: Math.max(0, Math.round(q) || 0),
        unit: String(wd.unit || 'bộ').trim(),
        maxValueVnd: Math.max(0, Math.round(maxVal) || 0),
        legacyNote: String(wd.legacyNote || '').trim(),
        note: String(wd.note || '').trim()
      });
    });
  }

  // 6. Extras (Quà tặng & quyền lợi)
  if (Array.isArray(rawDetails.extras)) {
    rawDetails.extras.forEach((ex, index) => {
      const q = Number(ex.quantity);
      const val = Number(ex.estimatedValueVnd);
      if (isNaN(q) || q < 0 || !Number.isInteger(q)) {
        errors.push(`Quà tặng dòng ${index + 1}: Số lượng phải là số nguyên không âm`);
      }
      if (isNaN(val) || val < 0) {
        errors.push(`Quà tặng dòng ${index + 1}: Giá trị ước tính không được âm`);
      }
      const incl = String(ex.included || 'included').toLowerCase();
      details.extras.push({
        id: ex.id || `ex_${Date.now()}_${index}`,
        title: String(ex.title || '').trim(),
        quantity: Math.max(0, Math.round(q) || 0),
        included: ['included', 'excluded', 'unset'].includes(incl) ? incl : 'included',
        estimatedValueVnd: Math.max(0, Math.round(val) || 0),
        note: String(ex.note || '').trim()
      });
    });
  }

  // 7. Terms (Điều kiện & ghi chú)
  if (Array.isArray(rawDetails.terms)) {
    rawDetails.terms.forEach((tm, index) => {
      details.terms.push({
        id: tm.id || `tm_${Date.now()}_${index}`,
        title: String(tm.title || '').trim(),
        body: String(tm.body || '').trim(),
        visibleToCustomer: tm.visibleToCustomer !== false,
        sortOrder: Number(tm.sortOrder) || index + 1
      });
    });
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors
    };
  }

  // Tính toán tổng số lượng để tự động đồng bộ sang legacy fields (AC-06: Tổng makeup thay đổi theo danh sách chi tiết)
  const totalLichChup = details.photoSchedules.reduce((sum, item) => sum + (Number(item.sessionCount) || 0), 0);
  const totalLichMake = details.makeupSessions.reduce((sum, item) => sum + (Number(item.sessionCount) || 0), 0);
  const totalAnhChinhSua = Number(details.photoRetouch.editedFileCount) || 0;

  let total16x21 = 0;
  let total20x30 = 0;
  let total60x90 = 0;

  details.deliverables.forEach(d => {
    const w = d.widthCm;
    const h = d.heightCm;
    const qty = Number(d.quantity) || 0;
    if ((w === 16 && h === 21) || (w === 21 && h === 16)) total16x21 += qty;
    if ((w === 20 && h === 30) || (w === 30 && h === 20)) total20x30 += qty;
    if ((w === 60 && h === 90) || (w === 90 && h === 60)) total60x90 += qty;
  });

  return {
    isValid: true,
    schemaVersion: 2,
    details,
    legacyFields: {
      soLuongLichChup: details.photoSchedules.length > 0 ? totalLichChup : (Number(legacyFallback.soLuongLichChup) || 0),
      soLuongLichMake: details.makeupSessions.length > 0 ? totalLichMake : (Number(legacyFallback.soLuongLichMake) || 0),
      soLuongAnhChinhSua: totalAnhChinhSua,
      soLuongAnh16x21: total16x21,
      soLuongAnh20x30: total20x30,
      soLuongAnh60x90: total60x90,
      trangDiemNgayAnHoi: legacyFallback.trangDiemNgayAnHoi || "",
      trangDiemNgayCuoi: legacyFallback.trangDiemNgayCuoi || "",
      trangPhucChoDoiBeLe: legacyFallback.trangPhucChoDoiBeLe || "",
      trangPhucCoDauNgayAnHoi: legacyFallback.trangPhucCoDauNgayAnHoi || "",
      trangPhucChuReNgayAnHoi: legacyFallback.trangPhucChuReNgayAnHoi || "",
      trangPhucVayCuoiNgayCuoi: legacyFallback.trangPhucVayCuoiNgayCuoi || "",
      trangPhucVestChuReNgayCuoi: legacyFallback.trangPhucVestChuReNgayCuoi || "",
      hoaCamTay: legacyFallback.hoaCamTay || ""
    }
  };
}

module.exports = {
  validateAndProcessPackageDetails
};

