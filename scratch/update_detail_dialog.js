const fs = require('fs');
const path = require('path');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js';

let content = fs.readFileSync(filePath, 'utf8');

// 1. Toast warning
const target1 = 'toast.warning("Chưa có đường dẫn ảnh. Vui lòng nhập link Google Drive.");';
const replacement1 = 'toast.warning("Chưa có đường dẫn ảnh. Vui lòng nhập link Google Drive hoặc Google Photos.");';

// 2. Step 2 description
const target2 = 'Vui lòng nhập đường dẫn thư mục chứa ảnh gốc của khách hàng:';
const replacement2 = 'Vui lòng nhập đường dẫn thư mục Google Drive hoặc Album chia sẻ Google Photos chứa ảnh gốc của khách hàng:';

// 3. Step 2 placeholder
const target3 = 'placeholder="https://drive.google.com/drive/folders/..."';
const replacement3 = 'placeholder="https://drive.google.com/drive/folders/... hoặc https://photos.app.goo.gl/..."';

// 4. Step 3 description
const target4 = 'Vui lòng nhập đường dẫn thư mục chứa ảnh đã chỉnh sửa (ảnh hậu kỳ):';
const replacement4 = 'Vui lòng nhập đường dẫn thư mục Google Drive hoặc Album chia sẻ Google Photos chứa ảnh đã chỉnh sửa (ảnh hậu kỳ):';

// 5. Step 3 placeholder - same as target3, we will replace it in context
// To be safe, let's replace all occurrences of the placeholder with the new one.
// Let's check how many times the targets appear to make sure we don't break anything.

console.log("Checking target 1 count:", content.split(target1).length - 1);
console.log("Checking target 2 count:", content.split(target2).length - 1);
console.log("Checking target 3 count:", content.split(target3).length - 1);
console.log("Checking target 4 count:", content.split(target4).length - 1);

content = content.replace(target1, replacement1);
content = content.replace(target2, replacement2);
content = content.replace(target4, replacement4);
// Replace both instances of target3
content = content.split(target3).join(replacement3);

fs.writeFileSync(filePath, content, 'utf8');
console.log("File updated successfully.");
