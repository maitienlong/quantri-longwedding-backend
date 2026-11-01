/**
 * Adapter và parser trích xuất dữ liệu Legacy sang Schema v2 cho Gói dịch vụ Long Wedding.
 * Đảm bảo:
 * - Idempotent: chạy nhiều lần không làm biến dạng dữ liệu
 * - Giữ nguyên mã, tên, giá, ảnh đại diện, trường cũ
 * - Fallback legacyNote khi parser không chắc chắn (AC-07)
 */

function isMeaningful(str) {
  if (!str) return false;
  const s = String(str).trim().toLowerCase();
  return s !== '' && s !== 'không' && s !== 'không có' && s !== 'khong' && s !== 'khong co' && s !== '0';
}

function parseWardrobeText(text, defaultKind = 'ao_dai', defaultOccasion = 'engagement', defaultRecipient = 'bride') {
  if (!text || !isMeaningful(text)) return null;

  const raw = String(text).trim();
  let quantity = 0;
  let unit = 'bộ';
  let itemType = defaultKind;
  let maxValueVnd = 0;
  let legacyNote = '';

  // Check if text is just a currency / price like "2.000.000" or "2000000"
  const digitsOnly = raw.replace(/[^0-9]/g, '');
  const isPureNumber = /^[0-9.,\s]+$/.test(raw) && digitsOnly.length >= 5;

  if (isPureNumber) {
    maxValueVnd = parseInt(digitsOnly, 10) || 0;
    quantity = 0; // KHÔNG suy đoán số lượng váy theo yêu cầu mapping legacy
    unit = 'bộ';
    return {
      occasion: defaultOccasion,
      recipient: defaultRecipient,
      itemType,
      quantity,
      unit,
      maxValueVnd,
      legacyNote: '',
      note: `Giá trị cam kết: ${raw} VNĐ`
    };
  }

  // Regex patterns: "1 Áo dài", "5 Bộ", "1 Vest", "2 bộ váy cưới"
  const qtyMatch = raw.match(/^(\d+)\s*([a-zA-ZÀ-ỹ]+)?\s*(.*)$/i);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10) || 1;
    const rawUnit = (qtyMatch[2] || '').toLowerCase();
    if (['bộ', 'bo', 'chiếc', 'chiec', 'cái', 'cai'].includes(rawUnit)) {
      unit = rawUnit === 'bo' ? 'bộ' : (rawUnit === 'chiec' ? 'chiếc' : (rawUnit === 'cai' ? 'cái' : rawUnit));
    }

    const remainingText = (qtyMatch[3] || '').trim().toLowerCase();
    if (remainingText.includes('áo dài') || remainingText.includes('ao dai')) {
      itemType = 'ao_dai';
    } else if (remainingText.includes('vest')) {
      itemType = 'vest';
    } else if (remainingText.includes('váy') || remainingText.includes('vay')) {
      itemType = 'wedding_dress';
    } else if (defaultKind) {
      itemType = defaultKind;
    }

    // Check if remainingText has price like "(giá trị) 2.000.000"
    const priceInMatch = remainingText.match(/(\d[\d.,\s]{3,})/);
    if (priceInMatch) {
      const priceDigits = priceInMatch[1].replace(/[^0-9]/g, '');
      if (priceDigits.length >= 5) {
        maxValueVnd = parseInt(priceDigits, 10) || 0;
      }
    }
  } else {
    // Parser không chắc chắn -> lưu legacyNote
    legacyNote = raw;
    quantity = 1;
  }

  return {
    occasion: defaultOccasion,
    recipient: defaultRecipient,
    itemType,
    quantity,
    unit,
    maxValueVnd,
    legacyNote,
    note: ''
  };
}

function migrateLegacyToDetails(doc) {
  if (!doc) return null;

  // Nếu đã có details schemaVersion >= 2 và có deliverables, trả về luôn (Idempotent)
  if (doc.schemaVersion >= 2 && doc.details && (doc.details.deliverables?.length > 0 || doc.details.photoSchedules?.length > 0)) {
    return doc.details;
  }

  const details = {
    photoRetouch: {
      editedFileCount: Number(doc.soLuongAnhChinhSua) || 0,
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

  // 1. Deliverables (ảnh 16x21, 20x30, 60x90)
  let sortOrder = 1;
  const sl16 = Number(doc.soLuongAnh16x21) || 0;
  if (sl16 > 0) {
    details.deliverables.push({
      id: `del_${doc.maDichVu || 'pkg'}_16x21`,
      kind: 'photo_print',
      name: 'Ảnh để bàn 16x21',
      widthCm: 16,
      heightCm: 21,
      quantity: sl16,
      material: 'Ép gỗ lụa cao cấp',
      note: '',
      sortOrder: sortOrder++
    });
  }

  const sl20 = Number(doc.soLuongAnh20x30) || 0;
  if (sl20 > 0) {
    details.deliverables.push({
      id: `del_${doc.maDichVu || 'pkg'}_20x30`,
      kind: 'photo_print',
      name: 'Ảnh để bàn 20x30',
      widthCm: 20,
      heightCm: 30,
      quantity: sl20,
      material: 'Mika / Pha lê để bàn',
      note: '',
      sortOrder: sortOrder++
    });
  }

  const sl60 = Number(doc.soLuongAnh60x90) || 0;
  if (sl60 > 0) {
    details.deliverables.push({
      id: `del_${doc.maDichVu || 'pkg'}_60x90`,
      kind: 'photo_print',
      name: 'Ảnh cổng cưới 60x90',
      widthCm: 60,
      heightCm: 90,
      quantity: sl60,
      material: 'Mika HD bo viền Hàn Quốc',
      note: '',
      sortOrder: sortOrder++
    });
  }

  // 2. Photo Schedules
  const sessChup = Number(doc.soLuongLichChup) || (Number(doc.loaiDichVu) === 2 ? 1 : 0);
  if (sessChup > 0) {
    details.photoSchedules.push({
      id: `sch_${doc.maDichVu || 'pkg'}_1`,
      occasion: 'studio',
      sessionCount: sessChup,
      dayCount: sessChup,
      location: 'Studio Long Wedding',
      staff: 'Ekip Studio (1 Photo + 1 Makeup + 1 Hỗ trợ)',
      note: ''
    });
  }

  // 3. Makeup Sessions
  let mkIdx = 1;
  if (isMeaningful(doc.trangDiemNgayAnHoi)) {
    details.makeupSessions.push({
      id: `mk_${doc.maDichVu || 'pkg'}_${mkIdx++}`,
      occasion: 'engagement',
      recipient: 'bride',
      sessionCount: 1,
      location: 'Tại studio / nhà gái',
      note: String(doc.trangDiemNgayAnHoi).trim() === 'Có' ? '' : String(doc.trangDiemNgayAnHoi).trim()
    });
  }

  if (isMeaningful(doc.trangDiemNgayCuoi)) {
    details.makeupSessions.push({
      id: `mk_${doc.maDichVu || 'pkg'}_${mkIdx++}`,
      occasion: 'wedding_day',
      recipient: 'bride',
      sessionCount: 1,
      location: 'Tại nhà gái / tiệc cưới',
      note: String(doc.trangDiemNgayCuoi).trim() === 'Có' ? '' : String(doc.trangDiemNgayCuoi).trim()
    });
  }

  // Nếu chưa có dòng nào nhưng soLuongLichMake > 0 thì tạo 1 dòng mặc định
  if (details.makeupSessions.length === 0 && (Number(doc.soLuongLichMake) > 0 || Number(doc.loaiDichVu) === 4)) {
    details.makeupSessions.push({
      id: `mk_${doc.maDichVu || 'pkg'}_${mkIdx++}`,
      occasion: 'unspecified',
      recipient: 'bride',
      sessionCount: Number(doc.soLuongLichMake) || 1,
      location: 'Studio Long Wedding',
      note: ''
    });
  }

  // 4. Wardrobe
  let wdIdx = 1;
  const cdAnHoi = parseWardrobeText(doc.trangPhucCoDauNgayAnHoi, 'ao_dai', 'engagement', 'bride');
  if (cdAnHoi) {
    cdAnHoi.id = `wd_${doc.maDichVu || 'pkg'}_${wdIdx++}`;
    details.wardrobe.push(cdAnHoi);
  }

  const crAnHoi = parseWardrobeText(doc.trangPhucChuReNgayAnHoi, 'ao_dai', 'engagement', 'groom');
  if (crAnHoi) {
    crAnHoi.id = `wd_${doc.maDichVu || 'pkg'}_${wdIdx++}`;
    details.wardrobe.push(crAnHoi);
  }

  const beTrap = parseWardrobeText(doc.trangPhucChoDoiBeLe, 'ao_dai_be_trap', 'engagement', 'bridesmaid');
  if (beTrap) {
    beTrap.id = `wd_${doc.maDichVu || 'pkg'}_${wdIdx++}`;
    beTrap.note = 'Đội bê đỡ tráp';
    details.wardrobe.push(beTrap);
  }

  const vayCuoi = parseWardrobeText(doc.trangPhucVayCuoiNgayCuoi, 'wedding_dress', 'wedding_day', 'bride');
  if (vayCuoi) {
    vayCuoi.id = `wd_${doc.maDichVu || 'pkg'}_${wdIdx++}`;
    details.wardrobe.push(vayCuoi);
  }

  const vestCuoi = parseWardrobeText(doc.trangPhucVestChuReNgayCuoi, 'vest', 'wedding_day', 'groom');
  if (vestCuoi) {
    vestCuoi.id = `wd_${doc.maDichVu || 'pkg'}_${wdIdx++}`;
    details.wardrobe.push(vestCuoi);
  }

  // 5. Extras (Quà tặng & hoa cưới)
  let exIdx = 1;
  if (isMeaningful(doc.hoaCamTay)) {
    details.extras.push({
      id: `ex_${doc.maDichVu || 'pkg'}_${exIdx++}`,
      title: 'Hoa tươi cầm tay cô dâu + hoa cài áo chú rể',
      quantity: 1,
      included: 'included',
      estimatedValueVnd: 500000,
      note: String(doc.hoaCamTay).trim() === 'Có' ? '' : String(doc.hoaCamTay).trim()
    });
  }

  return details;
}

module.exports = {
  isMeaningful,
  parseWardrobeText,
  migrateLegacyToDetails
};

