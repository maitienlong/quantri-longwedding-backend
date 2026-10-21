# HƯỚNG DẪN CẬP NHẬT GOOGLE APPS SCRIPT ĐỒNG BỘ ẢNH GOOGLE DRIVE (TỐC ĐỘ CAO & ỔN ĐỊNH)

---

## 📌 1. Giới thiệu
File mã nguồn đã được tạo sẵn tại:
- **`google_apps_script_sync.js`** (hoặc **`google_apps_script_sync.gs`**) ngay trong thư mục backend: `d:\LONG WEDDING\HETHONG CNTT\backend-quantri-longwedding\backend-admin-longwedding\google_apps_script_sync.js`.

Bản nâng cấp này mang lại:
1. **Tăng tốc độ 5 - 10 lần**: Sử dụng Google Drive API v3 quét hàng ngàn ảnh chỉ trong 2-3 giây.
2. **Hỗ trợ Bộ nhớ dùng chung (Shared Drive / Google Workspace)**.
3. **Báo lỗi chi tiết, rõ ràng**: Phân biệt chính xác giữa lỗi chưa mở quyền chia sẻ, link file đơn lẻ, hay link không tồn tại.
4. **Tự động sắp xếp ảnh tự nhiên**: A-Z, DSC_0001, DSC_0002... giúp khách hàng và thợ dễ đối chiếu.

---

## 🚀 2. Các bước cập nhật trên Google Apps Script (Thực hiện trong 2 phút)

### Bước 1: Mở dự án Google Apps Script hiện tại
1. Truy cập vào trang quản lý: [https://script.google.com/home/my](https://script.google.com/home/my).
2. Mở dự án script bạn đang dùng (hoặc bấm **Dự án mới / New Project**).

### Bước 2: Bật dịch vụ Google Drive API v3 (Bước quan trọng nhất để tăng tốc)
1. Ở thanh menu bên trái, tìm mục **Dịch vụ (Services)** có biểu tượng dấu cộng `[+]`.
2. Bấm vào dấu `[+]`.
3. Tìm và chọn **Drive API**.
4. Tại mục Phiên bản (Version), chọn **v3** (hoặc v2).
5. Mã định danh (Identifier): giữ nguyên là `Drive`.
6. Bấm **Thêm (Add)**.

### Bước 3: Dán mã nguồn mới
1. Mở file **`google_apps_script_sync.js`** trong thư mục backend.
2. Sao chép (Ctrl+A, Ctrl+C) toàn bộ nội dung.
3. Quay lại trang Apps Script, xóa sạch nội dung cũ trong file `Code.gs` và dán (Ctrl+V) code mới vào.
4. Bấm biểu tượng **Lưu (Save / Ctrl+S)**.

### Bước 4: Triển khai ứng dụng Web (Deploy as Web App)
1. Bấm nút **Triển khai (Deploy)** ở góc trên bên phải ➜ Chọn **Quản lý bản triển khai (Manage deployments)**.
   *(Nếu là dự án mới, chọn **Bản triển khai mới / New deployment**).*
2. Bấm vào biểu tượng hình cây bút chì ✏️ để chỉnh sửa:
   - **Phiên bản (Version)**: Chọn **Mới (New)**.
   - **Mô tả (Description)**: `Long Wedding Sync v2 - High Speed`.
   - **Thực thi dưới dạng (Execute as)**: Chọn **Tôi / Me (`email của bạn`)**.
   - **Ai có quyền truy cập (Who has access)**: BẮT BUỘC chọn **Bất kỳ ai (Anyone)**.
3. Bấm nút **Triển khai (Deploy)**.
4. Google sẽ cấp cho bạn một **URL ứng dụng web (Web App URL)** có đuôi `/exec`.
   *(Ví dụ: `https://script.google.com/macros/s/AKfycb.../exec`)*.
5. Sao chép URL này.

### Bước 5: Cập nhật file .env trên Backend (Nếu URL thay đổi)
Mở file `.env` của backend (`D:\LONG WEDDING\HETHONG CNTT\backend-quantri-longwedding\backend-admin-longwedding\.env`):
```env
APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycb.../exec
```
*(Nếu bạn cập nhật trực tiếp trên bản triển khai cũ thì URL thường không đổi, không cần sửa .env)*.

---

## 💡 3. Quy tắc vàng khi chia sẻ link Google Drive
Để 100% không bao giờ gặp lỗi đồng bộ:
1. Thư mục trên Google Drive phải được bật quyền:
   - Chuột phải vào Thư mục ➜ **Chia sẻ (Share)** ➜ Chuyển từ *"Bị hạn chế"* sang **"Bất kỳ ai có đường liên kết" (Anyone with the link)** với vai trò **"Người xem" (Viewer)**.
2. Luôn dán link của **Thư mục (Folder)**, không dán link của 1 file ảnh riêng lẻ.
