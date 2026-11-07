# LONG WEDDING v2.0 — PHÂN TÍCH SAI KHÁC VÀ LỖ HỔNG (GAP ANALYSIS)

**Mã tài liệu:** `docs/v2/02-gap-analysis.md`  
**Phiên bản:** 1.0 | **Ngày lập:** 03/11/2026 | **Tác giả:** Antigravity  
**Trạng thái:** Báo cáo kiểm định thực tế (Verified against HEAD)

---

## 1. TỔNG QUAN KẾT QUẢ ĐỐI SOÁT

Hệ thống mã nguồn thực tế tại Frontend (`dev1.0` @ `61ef333`) và Backend (`dev` @ `125cee9`) đã được kiểm kê toàn diện. Kết quả đối chiếu với đặc tả `LONG_WEDDING_V2_SPEC.md` cho thấy hệ thống đã có khung nền tảng nghiệp vụ tương đối phong phú, nhưng đang tồn tại **các lỗ hổng bảo mật nghiêm trọng cấp P0** (lộ secret, bypass auth, IDOR portal, SSRF, thiếu xác thực webhook) và **sự phân mảnh về cấu trúc dữ liệu** (hợp đồng lưu snapshot chưa chuẩn, thanh toán chưa dùng ledger bất biến, thiếu conflict locking khi xếp lịch).

### Quy ước gắn nhãn trạng thái:
- `verified`: Đã xác minh có trong code và hoạt động đúng đặc tả hoặc đã xác nhận lỗ hổng tồn tại chính xác như tài liệu cảnh báo.
- `partial`: Đã có một phần tính năng nhưng thiếu các rào chắn an toàn, thiếu validation hoặc chưa hoàn thiện luồng.
- `not found`: Chưa có trong hệ thống hiện tại, hoàn toàn là tính năng mới cần phát triển.
- `proposed`: Đề xuất thiết kế trong đặc tả v2.0 chưa được đưa vào mã nguồn.

---

## 2. BẢNG ĐỐI CHIẾU CHI TIẾT CÁC HẠNG MỤC P0 BẢO MẬT

| Mã | Hạng mục kiểm tra | Hiện trạng trong Code HEAD | Trạng thái | Bằng chứng mã nguồn (File & Symbol) |
|---|---|---|---|---|
| **SEC-01** | Quản lý Secret & Artifacts Git | File `.env` đang được commit và theo dõi trực tiếp bởi Git ở cả hai repo. `backend-admin-longwedding/node_modules/` bị commit lên repo Git. Secret key SePay bị hardcode làm default trong model. | **VERIFIED (VULNERABLE)** | - `quantri-longwedding/.env`<br>- `backend-admin-longwedding/.env`<br>- `backend-admin-longwedding/src/models/sepayConfig.model.js#L8` (`secretKey: "whsec_..."`) |
| **SEC-02** | JWT Token Expiry & RBAC Backend | 1. Token có thời hạn 36,500 ngày (100 năm).<br>2. Endpoint `refreshToken` nhận token hết hạn với cờ `{ ignoreExpiration: true }`, không có cơ chế revoke.<br>3. Hardcode quyền Quản lý theo username: `requester.username === "along"`.<br>4. Một số router thiếu hoàn toàn `authMiddleware`. | **VERIFIED (VULNERABLE)** | - `user.service.js#L186`: `expiresIn: "36500d"`<br>- `user.service.js#L226`: `jwt.verify(..., { ignoreExpiration: true })`<br>- `user.service.js#L60`, `#L269`: `username === "along"`<br>- `loaiHopDong.router.js`, `loaiDichVu.router.js`, `donViNhanTien.router.js`: 100% routes không có auth. |
| **SEC-03** | Webhook SePay & Sổ thanh toán | 1. Hàm `handleWebhook` chỉ xác thực nếu client có gửi header; nếu client không gửi header thì **bỏ qua xác thực và tiếp tục xử lý tiền** (fail-open).<br>2. Regex bóc tách mã hợp đồng có fallback tìm chuỗi 6 số bất kỳ, có nguy cơ match nhầm hợp đồng.<br>3. Kiểm tra trùng `alreadyProcessed` thực hiện trong bộ nhớ sau khi query, không có DB transaction/unique compound index; chạy song song 10 request cùng lúc sẽ bị ghi nhận trùng.<br>4. Tiền được cộng trực tiếp vào `HopDong.thanhToan` thay vì thông qua ledger bất biến. | **VERIFIED (VULNERABLE)** | - `sepay.service.js#L89-L93`: Chỉ `return 401` nếu `webhookSecret && signatureHeader && !isValidSig`. Thiếu signature vẫn chạy tiếp!<br>- `sepay.service.js#L166-L179`: Fallback match 6 số bất kỳ.<br>- `sepay.service.js#L196`: `alreadyProcessed` check array in-memory.<br>- `sepay.service.js#L265`: `HopDong.findByIdAndUpdate` không nằm trong Mongoose Session Transaction. |
| **SEC-04** | Cổng khách hàng & Album Proofing | 1. `GET /api/album/admin/list` và `GET /api/album/admin/:maHopDong` hoàn toàn không có `authMiddleware`. Bất kỳ ai cũng lấy được danh sách và chi tiết toàn bộ album studio.<br>2. Cổng `/api/album/portal/:maHopDong` truy cập chỉ bằng `maHopDong` (IDOR). Không có `PortalAccessGrant` token.<br>3. Client Portal trả về toàn bộ thông tin khách hàng, số điện thoại, tiến độ thanh toán và mã QR.<br>4. Action chọn ảnh, ghim ghi chú, chốt album không yêu cầu token phiên khách hàng. | **VERIFIED (VULNERABLE)** | - `album.router.js#L8-L9`: Route admin thiếu auth.<br>- `album.router.js#L13-L15`: Route portal không auth.<br>- `album.service.js#L696-L697`: Populate SĐT khách hàng.<br>- `ClientPortal.js#L60-L100`: Fallback 4 ảnh demo Unsplash khi album trống. |
| **SEC-05** | SSRF & Proxy Media | Endpoint `POST /api/album/download-base64` nhận `url` tùy ý từ body và gọi `axios.get(targetUrl, { maxRedirects: 5 })` mà không hề xác thực domain, không kiểm tra IP nội bộ (localhost, 127.0.0.1, 169.254.169.254, private CIDR). Route này lại là **Public** không cần đăng nhập. | **VERIFIED (CRITICAL VULNERABILITY)** | - `album.router.js#L27`: `router.post('/download-base64', albumService.convertDriveToBase64)` (không có auth)<br>- `album.service.js#L649-L665`: Gọi `axios.get(targetUrl)` không kiểm tra an toàn. |
| **SEC-06** | Socket.IO, CORS & Lộ dữ liệu | 1. Socket.IO khởi tạo với `origin: "*"` và không có authentication middleware trong handshake connection.<br>2. Khi webhook nhận tiền, gọi `io.emit("payment_success", paymentData)` phát toàn bộ thông tin hợp đồng, số tiền, số dư còn lại đến tất cả socket kết nối trên thế giới. | **VERIFIED (VULNERABLE)** | - `socket.js#L7-L10`: `cors: { origin: "*" }`<br>- `socket.js#L13`: `io.on("connection")` không có middleware xác thực token.<br>- `socket.js#L34`: `io.emit("payment_success", paymentData)` toàn cục. |
| **SEC-07** | Báo lỗi giao diện & Audit Log | 1. Trên giao diện `ClientPortal.js`, khi khách bấm tim hoặc ghim ghi chú, hệ thống gọi `toast.success()` trước khi API hoàn tất. Khi API thất bại chỉ `console.warn` mà không báo lỗi cho người dùng (False Positive).<br>2. Endpoint tạo Audit Log `POST /api/log` không có authMiddleware, bất kỳ ai cũng gửi log giả mạo. | **VERIFIED (VULNERABLE)** | - `ClientPortal.js#L163`: `toast.success` gọi trước API.<br>- `ClientPortal.js#L239`: `toast.success` gọi trước API.<br>- `log.router.js#L8`: `router.post('/')` không có authMiddleware. |

---

## 3. BẢNG ĐỐI CHIẾU CÁC PHÂN HỆ NGHIỆP VỤ (MOD-01 ĐẾN MOD-12)

| Mã Phân hệ | Yêu cầu Đặc tả v2.0 | Hiện trạng trong Code HEAD | Trạng thái | Đánh giá sai khác (Gaps) |
|---|---|---|---|---|
| **MOD-01** | Bảng giá / Gói dịch vụ / Khổ ảnh | Model `dichVu.model.js` đã có `details` với 7 nhóm cấu hình và `schemaVersion: 2`. Đã có bảng kích thước ảnh `kichThuocAnh.model.js`. Tuy nhiên chưa có collection `PackageVersion` riêng biệt, việc publish chưa tạo version bất biến độc lập. | **PARTIAL** | Cần tách thực thể phiên bản bảng giá `PackageVersion` để khi sửa gói không ghi đè trực tiếp lên gói hiện hành mà tạo revision mới; Hợp đồng cũ cần trỏ đến snapshot bất biến. |
| **MOD-02** | CRM, Lead & Khách hàng | Đã có `Lead`, `KhachHang`, UI `QuanLyLead.js`. Endpoint `POST /api/leads/convert` đã chuyển Lead sang Hợp đồng. | **PARTIAL** | Thiếu chống trùng lặp (Idempotency Key): double-click sẽ tạo ra 2 hợp đồng từ 1 Lead. Thiếu transaction khi convert. Chưa cho chọn linh hoạt loại dịch vụ khi convert (mặc định FULL_WEDDING). |
| **MOD-03** | Hợp đồng & Phụ lục | Đã có `HopDong`, `gioHang`, `phuLucPhatSinh`, `auditLog`. Giai đoạn có `giaiDoan` (1-5) và `subGiaiDoan` (enum 17 trạng thái). | **PARTIAL** | 1. Chưa có State Machine Guard ở backend để chặn nhảy cóc trạng thái trái phép.<br>2. Endpoint `POST /hopDong/update` cho phép sửa thẳng `cacLuotThanhToan` và `giamGia` mà không kiểm tra role Quản lý.<br>3. Thiếu `ContractAmendment` append-only riêng biệt. |
| **MOD-04** | Lịch chụp, Ekip & Tài nguyên | Có `cacNgay`, mảng `lichChup`, `lichTrangDiem`, `serviceSchedules` nhúng trong `HopDong`. Lịch hiển thị trên `LichCuaHang.js`. | **PARTIAL** | Chưa có entity `Booking` và `ResourceAssignment` độc lập. Việc kiểm tra trùng lịch chỉ thực hiện ở frontend hoặc thủ công; thiếu server-side interval conflict locking giữa 2 thợ trùng giờ. |
| **MOD-05** | Kho váy/vest & Lịch soạn đồ | Đã có `TrangPhuc` (tinhTrang, phanLoai), `LichSoanDo`, API `check-conflict` và `calendar`. | **PARTIAL** | Model `LichSoanDo` lưu `ngayMuon`, `ngayTra` dưới dạng `String` thay vì `Date`. Thiếu buffer thời gian giặt sửa tự động giữa các ca thuê. Chưa có biên bản check-in/check-out độc lập có chữ ký/ảnh đối soát. |
| **MOD-06** | Hậu kỳ, Chọn ảnh, Duyệt Album | Đã có `Album`, `anhSchema`, pin comment `(coordinateX, coordinateY)`. Có `ClientPortal.js` cho khách duyệt. | **PARTIAL** | Chưa chuẩn hóa tọa độ `[0, 1]` tương đối với kích thước ảnh gốc (đang dùng số % tính từ client viewport). Thiếu `PortalAccessGrant` token; thiếu versioning cho các đợt retouch (v1, v2, v3); còn chứa ảnh demo Unsplash. |
| **MOD-07** | In ấn & Bàn giao sản phẩm | Trong `hopDong.model.js` đã có trường `hauKy.thongTinInAn` (tenXuongIn, ngayGuiIn, chiPhiIn). | **PARTIAL** | Chưa có collection `DeliverableOrder` và `PrintJob` độc lập. Chưa có quy trình nghiệm thu QC từng sản phẩm trước khi đóng hợp đồng. |
| **MOD-08** | Thu chi, Công nợ & Đối soát | Đã có `ChiTieu`, `Payment` model, lịch sử `cacLuotThanhToan` trong Hợp đồng. SePay tự động gạch nợ. | **PARTIAL** | Chưa có sổ cái tài chính kép (Ledger). `Payment` model chỉ lưu rời rạc không dùng session transaction; không có bảng đối soát `ReconciliationRun` để so khớp tiền ngân hàng vs tiền hợp đồng. |
| **MOD-09** | Nhiệm vụ, Nhắc việc & Thông báo | Có `hopDong.service.getReminders` trả về lịch chụp, makeup ngày mai, váy sắp lấy/quá hạn. MainV2 polling mỗi 2 phút. | **PARTIAL** | Chưa có bảng `WorkTask` và `NotificationOutbox`. Nhắc việc đang tính toán runtime trên toàn bộ hợp đồng bằng query aggregation thay vì task state engine. |
| **MOD-10** | Nhân sự, KPI & Quyền | Đã có `User`, `ThiDua`, `StoreTarget`, `permissionHelper.js` với 16 quyền chi tiết. | **PARTIAL** | Quyền hạn chủ yếu kiểm tra ở Frontend qua `permissionHelper.js`. Backend chỉ có middleware kiểm tra role `"Quản lý"`, thiếu policy kiểm tra granular permissions trên từng API resource. |
| **MOD-11** | Website, CMS, Voucher, Thiệp cưới | Đã có `ThiepCuoi`, `Voucher`, `Website` section data. | **PARTIAL (CRITICAL SEC)** | Phân hệ thiệp cưới bị hở các API ghi/xóa/đọc khách mời (`/api/thiep-cuoi/*`) không cần đăng nhập. Cần áp dụng auth & owner policy trước khi mở rộng tính năng. |
| **MOD-12** | Dashboard quản trị & Phân tích | Đã có `DoanhThu.js`, `TongQuan.js`, `baoCao.service.js`. | **PARTIAL** | Các con số thống kê doanh thu đang tính lặp lại bằng logic riêng ở từng controller; chưa dựa trên nguồn sự thật duy nhất (Single Source of Truth). |

---

## 3. DANH SÁCH BẤT BIẾN NGHIỆP VỤ BẮT BUỘC BẢO VỆ

Trong suốt quá trình nâng cấp v2.0, Antigravity phải duy trì tuyệt đối các bất biến sau:

1. **Bất biến Hợp đồng:** Mã hợp đồng (`maHopDong`), ngày ký, tổng giá trị hợp đồng, các khoản đã thu và công nợ còn lại của tất cả hợp đồng đã phát sinh trong quá khứ không được thay đổi ngầm sau khi chạy nâng cấp backend hoặc migration.
2. **Bất biến Tiền thực thu:** Số tiền đã gạch nợ qua SePay hoặc tiền mặt phải được đối soát khớp 100% giữa hợp đồng và bảng kê tài chính.
3. **Bất biến Album & Ảnh chọn:** Các ảnh khách đã chọn (`isHearted: true`) và ghi chú chỉnh sửa của các hợp đồng đang thực hiện không được bị mất hoặc dịch chuyển tọa độ khi chuyển đổi schema.
4. **Bất biến Tương thích ngược:** Frontend v1 hiện hành phải tiếp tục hoạt động bình thường trên backend mới thông qua bộ Adapter tương thích.

