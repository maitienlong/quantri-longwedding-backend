# LONG WEDDING v2.0 — ĐẶC TẢ GIAO DIỆN API (API CONTRACT & ROUTE PLAN)

**Mã tài liệu:** `docs/v2/03-api-contract.md`  
**Phiên bản:** 1.0 | **Ngày lập:** 03/11/2026 | **Tác giả:** Antigravity  
**Trạng thái:** Đặc tả kỹ thuật triển khai (Design & Implementation Ready)

---

## 1. QUY CHUẨN GIAO THỨC API v2.0

Tất cả các API mới hoặc các thay đổi phá vỡ (breaking changes) sẽ được gắn tiền tố `/api/v2/*`. Toàn bộ các API v1 hiện tại được duy trì thông qua lớp tương thích (Compatibility Adapters) để đảm bảo frontend hiện hành không bị gián đoạn.

### 1.1. Chuẩn định dạng phản hồi (Response Envelope)

#### Phản hồi thành công (HTTP 200, 201)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "req_1790123456_abcdef",
    "timestamp": "2026-11-03T16:30:00.000Z",
    "schemaVersion": 2
  }
}
```

#### Phản hồi lỗi (HTTP 4xx, 5xx)
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_CONFLICT",
    "message": "Lịch thợ chụp đã được đặt kín trong khung giờ 08:00 - 12:00.",
    "details": [
      {
        "field": "thoChupHinh",
        "value": "Nguyễn Văn A",
        "conflictingBookingId": "bk_672b1234abcd"
      }
    ]
  },
  "meta": {
    "requestId": "req_1790123456_abcdef",
    "timestamp": "2026-11-03T16:30:00.000Z"
  }
}
```

### 1.2. Bảng mã lỗi chuẩn hóa (Standard Error Codes)
| HTTP Code | Error Code | Ý nghĩa nghiệp vụ |
|---|---|---|
| `400` | `INVALID_PAYLOAD` | Dữ liệu gửi lên sai định dạng, thiếu trường bắt buộc |
| `401` | `UNAUTHORIZED` | Chưa đăng nhập, token hết hạn hoặc chữ ký webhook không hợp lệ |
| `403` | `FORBIDDEN` | Tài khoản không có quyền trên tài nguyên hoặc sai phạm vi truy cập |
| `404` | `NOT_FOUND` | Không tìm thấy tài nguyên |
| `409` | `RESOURCE_CONFLICT` | Trùng lịch thợ, trùng mã giao dịch, hoặc xung đột trạng thái |
| `422` | `BUSINESS_RULE_VIOLATION` | Vi phạm quy tắc (vd: xóa hợp đồng đã phát sinh thanh toán) |
| `429` | `RATE_LIMITED` | Vượt ngưỡng tần suất request cho phép |
| `500` | `INTERNAL_SERVER_ERROR`| Lỗi máy chủ (ẩn stacktrace trong production) |

---

## 2. CHI TIẾT ĐẶC TẢ API v2 THEO THỨ TỰ ƯU TIÊN

### 2.1. Phân hệ P0: Xác thực, Phiên & Quyền (Auth & RBAC)

#### `POST /api/v2/auth/login`
- **Mục đích:** Đăng nhập an toàn, cấp phát Access Token ngắn hạn và Refresh Token xoay vòng (Rotated Refresh Token).
- **Request Body:**
  ```json
  {
    "username": "sale_anh",
    "password": "SecretPassword123"
  }
  ```
- **Response Data:**
  ```json
  {
    "accessToken": "eyJhbGciOi...", 
    "expiresIn": 900,
    "refreshToken": "rft_7b9c...",
    "user": {
      "id": "672b1000...",
      "username": "sale_anh",
      "fullname": "Nguyễn Thị Ánh",
      "positon": "Nhân viên Sale",
      "permissions": ["banhang", "lichcuahang", "leads"]
    }
  }
  ```
- **Chính sách an toàn:** Access token có thời hạn tối đa **15 phút**. Refresh token lưu dưới dạng hash SHA-256 trên server, có cơ chế revoke khi logout hoặc phát hiện token reuse.

#### `POST /api/v2/auth/refresh`
- **Mục đích:** Đổi refresh token lấy access token mới, áp dụng Refresh Token Rotation (cấp 1 refresh token mới, hủy cái cũ).
- **Request Body:**
  ```json
  {
    "refreshToken": "rft_7b9c..."
  }
  ```

#### `POST /api/v2/auth/logout`
- **Mục đích:** Thu hồi refresh token của phiên hiện tại trên database.
- **Header:** `Authorization: Bearer <accessToken>`

---

### 2.2. Phân hệ P0: Cổng Khách Hàng (Portal Scoped Grants)

#### `POST /api/v2/portal/access`
- **Mục đích:** Xác thực khách hàng qua mã hợp đồng + mã bảo vệ (hoặc OTP gửi qua SĐT) để sinh `PortalAccessGrant` token có thời hạn và giới hạn phạm vi (Scoped Grant).
- **Request Body:**
  ```json
  {
    "maHopDong": "HD2026360",
    "securityCode": "9451"
  }
  ```
- **Response Data:**
  ```json
  {
    "portalToken": "ptk_8a1f2e...",
    "expiresAt": "2026-11-10T23:59:59.000Z",
    "scopes": ["album:view", "photo:select", "album:approve", "contract:summary"]
  }
  ```

#### `GET /api/v2/portal/albums/:id`
- **Header:** `X-Portal-Token: ptk_8a1f2e...`
- **Bảo vệ:** Chỉ trả về dữ liệu cần thiết cho việc xem/chọn ảnh. **Tuyệt đối không trả về SĐT đầy đủ, doanh số nhân sự, hay ghi chú nội bộ.**

#### `PUT /api/v2/portal/albums/:id/selections`
- **Header:** `X-Portal-Token: ptk_8a1f2e...`
- **Request Body:**
  ```json
  {
    "photoId": "drv_1029384",
    "isHearted": true,
    "isCover": false
  }
  ```

#### `POST /api/v2/portal/albums/:id/retouch-notes`
- **Header:** `X-Portal-Token: ptk_8a1f2e...`
- **Request Body:** Tọa độ lưu dạng normalized `[0, 1]` kèm kích thước gốc để không bị lệch khi co giãn màn hình:
  ```json
  {
    "photoId": "drv_1029384",
    "normalizedX": 0.452,
    "normalizedY": 0.587,
    "originalWidth": 4000,
    "originalHeight": 6000,
    "note": "Xóa bớt nếp nhăn đuôi mắt cô dâu"
  }
  ```

#### `POST /api/v2/portal/albums/:id/approve`
- **Header:** `X-Portal-Token: ptk_8a1f2e...`
- **Request Body:**
  ```json
  {
    "revisionVersion": 1,
    "customerConfirmation": true,
    "note": "Tôi đồng ý chốt danh sách 45 ảnh này để in ấn."
  }
  ```
- **Cơ chế:** Ghi nhận lịch sử duyệt album với timestamp và IP an toàn; sinh task cho khâu in ấn.

---

### 2.3. Phân hệ P0: Webhook SePay & Sổ Thu Chi (Fail-Closed)

#### `POST /api/sepay/webhook` (Giữ nguyên path để tương thích cấu hình webhook SePay)
- **Cơ chế xác thực (Fail-Closed):**
  1. Kiểm tra sự tồn tại của header `X-SePay-Signature` hoặc API Key `Authorization: Bearer <SEPAY_API_KEY>`. Nếu thiếu header -> **Từ chối ngay với HTTP 401**.
  2. Xác minh HMAC SHA-256 signature với payload nguyên bản (`req.rawBody`).
  3. Kiểm tra timestamp header chống Replay Attack (lệch không quá 300 giây).
- **Chống ghi nhận trùng:**
  - Unique index trên database: `provider + providerTransactionId`.
  - Toàn bộ thao tác gạch nợ phải thực thi trong Mongoose Session Transaction (hoặc atomic findOneAndUpdate có điều kiện).
  - Không emit Socket.IO nếu transaction chưa commit thành công.

---

### 2.4. Phân hệ P0: Proxy Tải Ảnh An Toàn (SSRF Prevention)

#### `POST /api/v2/media/drive-proxy`
- **Mục đích:** Thay thế hoàn toàn endpoint rủi ro `/api/album/download-base64`.
- **Nguyên tắc an toàn:**
  1. **Chỉ chấp nhận `driveFileId` hợp lệ** (chuỗi ký tự regex `^[a-zA-Z0-9\-_]{20,50}$`).
  2. Không nhận `url` tùy ý từ client.
  3. URL tải được backend tự dựng: `https://drive.google.com/uc?export=download&id=${driveFileId}`.
  4. Stream data trực tiếp kèm giới hạn kích thước tối đa 25MB và giới hạn timeout 10s.

---

### 2.5. Phân hệ P1: Gói Dịch Vụ & Bảng Giá (MOD-01)

#### `GET /api/v2/packages`
- Trả về danh sách gói dịch vụ kèm thông tin phiên bản mới nhất đang phát hành (`publishedVersion`).

#### `POST /api/v2/packages/:id/versions`
- Tạo bản nháp phiên bản mới (`draftVersion`) cho gói dịch vụ, hỗ trợ thêm không giới hạn các khổ ảnh (16x21, 20x30, 30x45, custom mm).

#### `POST /api/v2/packages/:id/versions/:version/publish`
- Đóng dấu xuất bản phiên bản gói dịch vụ (`published`). Phiên bản này trở thành bất biến (immutable), không thể bị sửa đè.

---

### 2.6. Phân hệ P1: Hợp Đồng & Chuyển Trạng Thái (MOD-03)

#### `POST /api/v2/contracts/:id/transition`
- **Mục đích:** State Machine Guard kiểm soát việc chuyển giai đoạn hợp đồng.
- **Request Body:**
  ```json
  {
    "fromStatus": "awaiting_deposit",
    "toStatus": "active",
    "reason": "Khách đã thanh toán đủ cọc 30%",
    "evidenceRef": "SEPAY_TX_12345"
  }
  ```
- **Kiểm soát:** Chặn nhảy cóc trạng thái; kiểm tra điều kiện tiên quyết (ví dụ: muốn chuyển sang `in_production` thì phải có lịch chụp đã hoàn thành).

---

### 2.7. Phân hệ P1: Xếp Lịch & Tránh Xung Đột (MOD-04)

#### `GET /api/v2/bookings/availability`
- **Query Params:** `?start=2026-11-20T08:00:00Z&end=2026-11-20T12:00:00Z&resourceIds=thoChup_1,thoMake_2`
- **Kiểm tra:** Server-side interval conflict check theo khoảng nửa mở `[start, end)`.

#### `POST /api/v2/bookings/:id/confirm`
- **Mục đích:** Xác nhận lịch chụp/makeup. Sử dụng lock key hoặc atomic reservation để chặn race condition khi 2 điều phối viên cùng gán 1 thợ cùng giờ.

---

## 3. KẾ HOẠCH BẢO LƯU TƯƠNG THÍCH NGƯỢC (v1 ADAPTER LAYER)

1. **Các endpoint v1 hiện có giữ nguyên đường dẫn và dữ liệu trả về:**
   - `/hopDong/*`, `/dichVu/*`, `/khachHang/*`, `/chiTieu/*`, `/lichSoanDo/*`, `/trangPhuc/*`, `/vouchers/*`, `/leads/*`.
2. **Lớp Adapter xử lý nội bộ:**
   - Khi frontend v1 gọi `POST /hopDong/update`, backend route adapter sẽ ánh xạ payload sang định dạng v2, nhưng vẫn lưu vào cấu trúc v1 legacy để màn hình in hợp đồng và xem hợp đồng v1 hiển thị nguyên vẹn.
3. **Quy tắc không làm gián đoạn:**
   - Không xóa bất kỳ endpoint v1 nào cho đến khi toàn bộ Frontend được kiểm thử xong và có biên bản nghiệm thu chuyển đổi.
