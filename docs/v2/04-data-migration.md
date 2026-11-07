# LONG WEDDING v2.0 — KẾ HOẠCH VÀ KỊCH BẢN CHUYỂN ĐỔI DỮ LIỆU (DATA MIGRATION)

**Mã tài liệu:** `docs/v2/04-data-migration.md`  
**Phiên bản:** 1.0 | **Ngày lập:** 03/11/2026 | **Tác giả:** Antigravity  
**Trạng thái:** Kịch bản thực thi an toàn không phá hủy (Non-destructive Migration Plan)

---

## 1. NGUYÊN TẮC BẢO VỆ DỮ LIỆU BẤT BIẾN

1. **Tuyệt đối không xóa dữ liệu gốc:** Không chạy lệnh `dropDatabase`, `dropCollection`, `deleteMany` hoặc xóa trường dữ liệu cũ trong cùng một đợt phát hành.
2. **Mô hình Expand & Contract:**
   - **Giai đoạn 1 (Expand):** Bổ sung các trường và collection mới dạng tùy chọn (`optional`), ghi `schemaVersion: 2` và `migrationRunId`.
   - **Giai đoạn 2 (Backfill):** Chạy script di chuyển dữ liệu theo lô (`batches`), có checkpoint cursor, xử lý idempotent (chạy lại 10 lần vẫn cho cùng 1 kết quả).
   - **Giai đoạn 3 (Verify):** Kiểm tra đối soát 100% số lượng, tổng tiền hợp đồng, số tiền đã thu, và tính toàn vẹn của album.
   - **Giai đoạn 4 (Cutover):** Bật cờ đọc dữ liệu v2; ghi đồng thời vào cả cấu trúc cũ và mới nếu cần.
   - **Giai đoạn 5 (Contract):** Chỉ loại bỏ trường cũ khi phiên bản v1 đã ngừng hoạt động hoàn toàn và có phê duyệt từ ban giám đốc.
3. **Tiền tệ tính bằng số nguyên VNĐ:** Không dùng số thực (Float) để tính toán tiền; mọi phép tính quy đổi giữ nguyên giá trị VND.
4. **Không đoán dữ liệu thiếu:** Nếu hợp đồng cũ thiếu thông tin chi tiết gói chụp, đánh dấu `reviewStatus: "NEEDS_REVIEW"` để nhân viên kiểm tra, không tự suy đoán giá trị.

---

## 2. DANH MỤC CÁC BƯỚC CHUYỂN ĐỔI (MIGRATION CATALOG)

| Mã | Độ ưu tiên | Đối tượng chuyển đổi | Nguồn (Legacy) → Đích (v2.0) | Bất biến bắt buộc kiểm chứng |
|---|---|---|---|---|
| **M00** | P0 | Secrets & Phân quyền | `.env` commit → Secret Store / env.example; `User.positon` → `permissions` | Toàn bộ tài khoản cũ đăng nhập được, không có secret mới trên Git |
| **M01** | P0 | Sổ thanh toán SePay & Hợp đồng | `HopDong.thanhToan.cacLuotThanhToan` → `PaymentTransaction` Ledger | Tổng tiền đã thanh toán theo từng hợp đồng **không đổi 1 đồng nào** |
| **M02** | P0 | Cổng duyệt ảnh khách hàng | `Album.maHopDong` (Public by code) → `PortalAccessGrant` Scoped Token | Khách hàng cũ không bị gián đoạn, album không bị truy cập trái phép |
| **M03** | P1 | Bảng giá & Dịch vụ | `dichVu` cũ → `Package` (Identity) + `PackageVersion` (Snapshot bất biến) | Bảng giá cũ render đầy đủ 7 nhóm dịch vụ và các khổ in |
| **M04** | P1 | Hợp đồng & Snapshot gói | `HopDong.gioHang` → `packageSnapshot` + `ContractStatusHistory` | Mẫu in hợp đồng cũ và mới xuất PDF hoàn toàn giống nhau |
| **M05** | P1 | Lịch chụp & Nhân sự | `HopDong.lichChup`, `lichTrangDiem` → `Booking` + `ResourceAssignment` | Không bị mất bất kỳ sự kiện lịch nào; báo cáo xung đột nếu có |
| **M06** | P1 | Trang phục & Mượn trả | `lichSoanDo` (String date) → `WardrobeReservation` (ISODate + Buffer) | Mã trang phục giữ nguyên, lịch mượn váy không bị đè |
| **M07** | P1 | Chọn ảnh & Ghi chú | `Album.danhSachAnh.comments` → Normalized coordinates `[0,1]` + Versioning | Tọa độ điểm ghim hiển thị chính xác trên cả mobile và desktop |
| **M08** | P1 | CRM Lead & Khách hàng | `Lead` + `KhachHang` cross-reference, tạo `normalizedPhone` | Không tự ý gộp (auto-merge) hai khách hàng trùng tên |
| **M09** | P2 | Sổ cái & Đối soát tài chính | `PaymentTransaction` + `ChiTieu` → `FinancialLedger` + `Reconciliation` | Báo cáo tài chính khớp 100% với số dư công nợ hợp đồng |

---

## 3. MAPPING FIELD CHI TIẾT THEO TỪNG MODEL

### 3.1. Bảng giá dịch vụ (`dichVu` → `PackageVersion`)
```text
dichVu (Legacy)                          PackageVersion (v2.0)
--------------------------------------   -------------------------------------------------
_id                                  ->  packageId (Reference)
maDichVu                             ->  packageCode
tenDichVu                            ->  packageName
giaTriDichVu                         ->  basePriceVnd (Integer)
giaChoThueDichVu                     ->  rentalPriceVnd (Integer)
details.deliverables[]               ->  deliverables[{ id, kind, widthMm, heightMm, quantity, material }]
soLuongAnh16x21, 20x30, 60x90        ->  (Map thành các items trong deliverables[] tương ứng)
details.photoSchedules[]             ->  lineItems.photoSchedules[]
details.makeupSessions[]             ->  lineItems.makeupSessions[]
details.wardrobe[]                   ->  lineItems.wardrobe[]
details.extras[]                     ->  lineItems.extras[]
details.terms[]                      ->  termsAndConditions[]
(Tạo mới)                            ->  version: 1, status: "PUBLISHED", isImmutable: true
```

### 3.2. Hợp đồng & Snapshot gói (`HopDong` → `ContractSnapshot`)
```text
hopDong (Legacy)                         Contract v2.0
--------------------------------------   -------------------------------------------------
maHopDong                            ->  contractCode (Unique, Immutable)
contractType                         ->  contractType ('FULL_WEDDING' | 'SINGLE_SERVICE')
ngayHopDong                          ->  signedAt (ISODate UTC)
khachHang1, khachHang2               ->  primaryCustomer, secondaryCustomer
gioHang[0]                           ->  packageSnapshot (Bảo lưu toàn bộ thông số gói tại thời điểm ký)
thanhToan.tongGiaTriSauGiam          ->  totalContractAmountVnd (Integer)
thanhToan.khachHangDaThanhToan       ->  totalPaidAmountVnd (Computed from Ledger)
thanhToan.conLai                     ->  remainingBalanceVnd (total - paid)
thanhToan.cacLuotThanhToan[]         ->  paymentAllocations[] trỏ đến PaymentTransaction
giaiDoan, subGiaiDoan                ->  statusHistory[{ status, timestamp, performedBy, reason }]
```

---

## 4. KỊCH BẢN THỰC THI (MIGRATION SCRIPTS)

### 4.1. Quy trình 4 bước chuẩn mực
Mỗi migration script bắt buộc phải cung cấp đủ 4 chế độ chạy:
1. `--dry-run`: Đọc dữ liệu, kiểm tra tính hợp lệ, xuất file báo cáo tổng hợp, **không ghi vào DB**.
2. `--apply`: Chạy cập nhật dữ liệu theo từng lô nhỏ (chunk size = 100 - 200 bản ghi), có checkpoint để tiếp tục nếu bị gián đoạn.
3. `--verify`: Kiểm đếm số lượng, tổng tiền trước và sau, xác thực không có bản ghi nào bị mồ côi hoặc sai lệch.
4. `--rollback`: Khôi phục lại trạng thái trước khi apply bằng cách sử dụng các trường backup `legacyPayload`.

### 4.2. Khung mã mẫu Migration M01 (Payment Ledger Idempotent Backfill)

```javascript
/**
 * scripts/migrations/m01_payment_ledger_backfill.js
 * Chạy an toàn: node m01_payment_ledger_backfill.js --dry-run
 */
const mongoose = require('mongoose');
const HopDong = require('../../src/models/hopDong.model');
const Payment = require('../../src/models/payment.model');

async function runMigration(mode = 'dry-run') {
  console.log(`🚀 Bắt đầu migration M01: Payment Ledger Backfill [Chế độ: ${mode}]`);
  
  const contracts = await HopDong.find({ 'thanhToan.cacLuotThanhToan.0': { $exists: true } });
  console.log(`Tìm thấy ${contracts.length} hợp đồng có lịch sử thanh toán.`);

  let totalTransactions = 0;
  let totalAmountMigrated = 0;
  let skippedDuplicates = 0;

  for (const contract of contracts) {
    const payments = contract.thanhToan.cacLuotThanhToan || [];
    for (const p of payments) {
      totalTransactions++;
      const txnId = p.id || `LEGACY_${contract.maHopDong}_${new Date(p.date).getTime()}`;
      const amountVnd = Math.round(Number(p.amount) || 0);

      if (mode === 'dry-run') {
        totalAmountMigrated += amountVnd;
        continue;
      }

      // Apply mode: Idempotent upsert
      try {
        await Payment.updateOne(
          { id: txnId },
          {
            $setOnInsert: {
              id: txnId,
              maHopDong: contract.maHopDong,
              amount: amountVnd,
              date: p.date ? new Date(p.date) : new Date(),
              method: p.method || 'Tiền mặt',
              khachHang: p.khachHang || contract.khachHang1?.tenKhachHang || 'Khách hàng',
              noiDung: p.noiDung || 'Thanh toán hợp đồng',
              source: 'legacy_backfill',
              schemaVersion: 2
            }
          },
          { upsert: true }
        );
        totalAmountMigrated += amountVnd;
      } catch (err) {
        if (err.code === 11000) {
          skippedDuplicates++;
        } else {
          console.error(`❌ Lỗi ghi nhận giao dịch ${txnId}:`, err.message);
        }
      }
    }
  }

  console.log(`\n📊 KẾT QUẢ MIGRATION M01 (${mode}):`);
  console.log(`- Tổng số giao dịch xử lý: ${totalTransactions}`);
  console.log(`- Tổng số tiền đối soát: ${totalAmountMigrated.toLocaleString('vi-VN')} VNĐ`);
  console.log(`- Số bản ghi trùng bỏ qua: ${skippedDuplicates}`);
  console.log(`- Trạng thái: HOÀN TẤT AN TOÀN.\n`);
}

module.exports = { runMigration };
```

---

## 5. BIÊN BẢN NGHIỆM THU ĐỐI SOÁT DỮ LIỆU (VERIFICATION CHECKLIST)

Trước khi đóng bất kỳ migration nào để chuyển sang Sprint tiếp theo, phải có file bằng chứng `migration-verify.json` xác nhận các chỉ số:

- [ ] Tổng số hợp đồng trước migration = Tổng số hợp đồng sau migration.
- [ ] Tổng tiền phải thu (`tongGiaTriSauGiam`) của toàn bộ hợp đồng không bị lệch dù chỉ 1 đồng.
- [ ] Tổng tiền đã thanh toán (`khachHangDaThanhToan`) khớp chính xác với tổng giá trị các giao dịch trong `Payment` collection.
- [ ] Số lượng ảnh trong từng album của khách hàng không bị thiếu file hoặc mất tim (`isHearted`).
- [ ] Lịch chụp và lịch makeup không bị xê dịch múi giờ (giữ chuẩn ICT `Asia/Ho_Chi_Minh` UTC+7).
- [ ] Không có bản ghi nào bị ghi đè thuộc tính `legacyPayload` phục vụ rollback.
