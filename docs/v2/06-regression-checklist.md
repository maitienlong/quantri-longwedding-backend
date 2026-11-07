# LONG WEDDING v2.0 — DANH MỤC KIỂM THỬ HỒI QUY VÀ BẰNG CHỨNG (REGRESSION CHECKLIST)

**Mã tài liệu:** `docs/v2/06-regression-checklist.md`  
**Phiên bản:** 1.0 | **Ngày lập:** 03/11/2026 | **Tác giả:** Antigravity  
**Trạng thái:** Danh mục kịch bản kiểm thử bắt buộc (Mandatory Verification Matrix)

---

## 1. NGUYÊN TẮC NGHIỆM THU

1. **Không được báo "đã hoàn thành" khi chưa chạy test thực tế.**
2. Tất cả các ca kiểm thử P0 bắt buộc phải có script tự động hoặc curl test có lưu kết quả.
3. Không thực hiện test ghi dữ liệu giả mạo trên cơ sở dữ liệu thật của khách hàng.
4. Mọi lỗi bảo mật sau khi khắc phục phải được kiểm chứng lại bằng ca kiểm thử tiêu cực (Negative Test Case).

---

## 2. MA TRẬN CÁC CA KIỂM THỬ TỰ ĐỘNG BẮT BUỘC CẤP P0

| Mã Test | Điều kiện / Thao tác kiểm thử (Given - When) | Kết quả kỳ vọng (Then) | Kết quả thực tế HEAD | Trạng thái |
|---|---|---|---|---|
| **T-SEC01** | Gọi `GET /api/album/admin/list` mà không truyền header Authorization | Backend trả về `401 Unauthorized` hoặc `403 Forbidden`, không trả danh sách album | HEAD trả về HTTP 200 kèm danh sách toàn bộ album | **FAIL (Lỗ hổng cần sửa ở Sprint 1)** |
| **T-SEC02** | Khách thay đổi mã hợp đồng trên URL portal `/my-wedding/:maHopDong` | Không đọc được hợp đồng / album của người khác; hệ thống yêu cầu mã bảo vệ | HEAD trả về thông tin hợp đồng và album của mã mới | **FAIL (Lỗ hổng cần sửa ở Sprint 1)** |
| **T-SEC03** | Khách sử dụng Token portal đã hết hạn hoặc bị thu hồi | Request bị từ chối với HTTP 401/403, ghi nhận audit log an toàn | Hiện tại chưa có token portal | **FAIL (Cần bổ sung ở Sprint 1)** |
| **T-SEC04** | Nhân viên không có chức vụ Quản lý gọi API sửa tiền hoặc xóa hợp đồng | Backend trả về `403 Forbidden` và không làm thay đổi số dư hợp đồng | HEAD cho phép user thường sửa tiền qua `/hopDong/update` | **FAIL (Lỗ hổng cần sửa ở Sprint 1)** |
| **T-SEC05** | Refresh token đã bị thu hồi hoặc gửi lại token cũ | Backend từ chối cấp token mới, khóa chuỗi token nếu phát hiện gian lận | HEAD chấp nhận token hết hạn không kiểm tra DB | **FAIL (Lỗ hổng cần sửa ở Sprint 1)** |
| **T-PAY01** | Webhook SePay gửi lên nhưng thiếu signature hoặc sai API Key | Backend từ chối ngay với `401 Unauthorized`, không gạch nợ hợp đồng | HEAD bỏ qua xác thực và gạch nợ bình thường | **FAIL (Lỗ hổng cần sửa ở Sprint 1)** |
| **T-PAY02** | Webhook gửi 10 request đồng thời với cùng 1 mã giao dịch SePay | Chỉ có duy nhất 1 bản ghi thanh toán được ghi nhận, số tiền chỉ cộng 1 lần | HEAD kiểm tra in-memory ngoài transaction, bị race condition | **FAIL (Lỗ hổng cần sửa ở Sprint 1)** |
| **T-PAY03** | Webhook đúng mã giao dịch nhưng số tiền không hợp lệ (âm hoặc = 0) | Backend từ chối, không ghi sổ, đẩy vào hàng đợi đối soát | HEAD chặn số <= 0 nhưng chưa log đối soát | **PARTIAL** |
| **T-PAY04** | Quá trình lưu giao dịch gặp sự cố DB giữa chừng | Rollback toàn bộ, không tăng số đã thu trong Hợp đồng, không bắn Socket.IO | HEAD cập nhật Hợp đồng trước rồi mới lưu Payment ngoài transaction | **FAIL (Lỗ hổng cần sửa ở Sprint 1)** |
| **T-SEC06** | Gửi URL nội bộ (`http://127.0.0.1:5000/auth/findUsers`) vào API proxy media | Backend từ chối ngay trước khi fetch, chặn SSRF loopback/private IP | HEAD gọi `axios.get(targetUrl)` bất kỳ | **FAIL (Lỗ hổng cần sửa ở Sprint 1)** |
| **T-SEC07** | Client Socket.IO kết nối ẩn danh cố gắng lắng nghe sự kiện thanh toán | Socket bị ngắt kết nối hoặc không nhận được dữ liệu thanh toán nhạy cảm | HEAD emit `payment_success` toàn cục cho mọi client | **FAIL (Lỗ hổng cần sửa ở Sprint 1)** |
| **T-UI01** | Khách chọn ảnh trên portal khi mạng chập chờn / ngắt kết nối | Giao diện không báo thành công giả; lưu bản nháp offline và thông báo rõ | HEAD gọi `toast.success` trước, API lỗi chỉ `console.warn` | **FAIL (Lỗi UI cần sửa ở Sprint 1)** |

---

## 3. DANH MỤC KIỂM THỬ HỒI QUY NGHIỆP VỤ (BUSINESS REGRESSION MATRIX)

| Mã Test | Kịch bản kiểm thử chi tiết | Kết quả kỳ vọng | Ghi chú tương thích |
|---|---|---|---|
| **T-PKG01** | Tạo gói dịch vụ có cùng lúc 3 khổ ảnh: 16x21, 20x30, 30x45 và 1 khổ tùy chỉnh | Lưu, sửa draft, publish và hiển thị đầy đủ trên cả FE và API | Tương thích ngược với field cũ |
| **T-PKG02** | Thay đổi giá của một gói dịch vụ sau khi đã có hợp đồng ký | Hợp đồng cũ giữ nguyên 100% giá trị và snapshot gói tại thời điểm ký | Không bị đè giá mới |
| **T-CON01** | Mở và xem/in một hợp đồng cũ tạo từ năm 2025 (không có packageSnapshot v2) | Đọc và in hợp đồng bình thường không phát sinh lỗi giao diện hay thiếu chữ | Adapter đọc fallback |
| **T-CON02** | Thử chuyển giai đoạn hợp đồng từ "Chờ đặt cọc" thẳng sang "Đã hoàn thành" | Bị chặn lại với HTTP 409 hoặc 422, thông báo quy tắc nghiệp vụ rõ ràng | State Machine Guard |
| **T-LEAD01** | Click liên tục 2 lần nút "Chuyển thành Hợp đồng" trên màn hình Lead | Chỉ tạo ra duy nhất 1 hợp đồng, Lead gắn đúng ID hợp đồng đó | Idempotency Key |
| **T-LEAD02** | Chuyển đổi Lead dịch vụ "Chụp tiệc sinh nhật bé" sang hợp đồng | Hợp đồng tạo ra đúng loại dịch vụ sinh nhật, không bị ép thành FULL_WEDDING | Loại hợp đồng linh hoạt |
| **T-CAL01** | Gán cùng 1 thợ chụp cho 2 lịch chụp có khung giờ chồng lấn (08:00 - 11:00 và 09:00 - 12:00) | Hệ thống cảnh báo xung đột và từ chối xác nhận lịch thứ hai | Server-side Conflict Check |
| **T-CAL02** | Gán 1 thợ cho lịch 08:00 - 10:00 và lịch thứ hai 10:00 - 12:00 | Cho phép lưu hợp lệ nếu không cấu hình thời gian chuẩn bị (buffer) | Khoảng thời gian nửa mở |
| **T-WAR01** | Đặt giữ cùng 1 chiếc váy cưới cho 2 cô dâu trùng ngày cưới/ăn hỏi | Hệ thống phát hiện trùng lịch giữ đồ và đưa ra thông báo chặn | Quản lý kho váy |
| **T-ALB01** | Khách chấm điểm ghim yêu cầu sửa trên điện thoại iPhone, thợ mở xem trên máy tính | Điểm ghim nằm chính xác cùng vị trí tương đối trên khuôn mặt/trang phục | Normalized Coordinates |
| **T-ALB02** | Khách đã duyệt album phiên bản 1, nhân viên tải lên bản chỉnh sửa phiên bản 2 | Trạng thái chuyển về "Chờ khách duyệt v2", không tự động đánh dấu đã duyệt | Versioning Album |
| **T-PRINT01**| Đóng hợp đồng khi danh mục sản phẩm in ấn bắt buộc chưa được nghiệm thu QC | Chặn đóng hợp đồng trừ khi có Quản lý phê duyệt lý do override | Quản lý in ấn |
| **T-LEDGER01**| Chạy script migrate dữ liệu thanh toán cũ sang sổ cái Ledger | Tổng tiền theo từng hợp đồng trước và sau migration bằng nhau tuyệt đối | Tính toàn vẹn tài chính |
| **T-TASK01** | Gọi API sinh danh sách công việc tự động 3 lần liên tiếp cho 1 hợp đồng | Không bị nhân ba số lượng công việc (duplication guard) | Idempotent Workflow |
| **T-REPORT01**| So sánh số liệu Doanh thu & Công nợ trên Dashboard Tổng quan và Báo cáo chi tiết | Cùng một khoảng thời gian lọc, các con số phải trùng khớp 100% | Single Source of Truth |
| **T-LEGACY01**| Frontend v1 chạy cùng Backend v2 mới | Tất cả các luồng xem, sửa, in hợp đồng, xem lịch đều hoạt động trơn tru | Không gây downtime |

---

## 4. MẪU BẰNG CHỨNG KIỂM THỬ (TEST EXECUTION EVIDENCE TEMPLATE)

```markdown
### BẰNG CHỨNG KIỂM THỬ #<ID>
- **Thời gian thực hiện:** [YYYY-MM-DD HH:mm:ss]
- **Môi trường:** [Local / Staging / Isolated Sandbox]
- **Lệnh thực thi:** `npm test -- ...` hoặc `curl -X POST ...`
- **Kết quả HTTP Response:** `Status: 200 / 401 / 403`
- **Payload trả về:** [JSON trích xuất an toàn - ĐÃ ẨN TOÀN BỘ PII & SECRET]
- **Đánh giá:** [PASS / FAIL]
- **Người thực hiện:** [Antigravity / Lead Engineer]
```
