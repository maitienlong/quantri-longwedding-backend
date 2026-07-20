const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/LichCuaHang/LichCuaHang.js';

let content = fs.readFileSync(filePath, 'utf8');

// 1. Toast error in handleSyncAlbum
const target1 = 'toast.error("Chưa có đường dẫn ảnh. Vui lòng nhập link Google Drive.");';
const replacement1 = 'toast.error("Chưa có đường dẫn ảnh. Vui lòng nhập link Google Drive hoặc Google Photos.");';

// 2. TextField placeholders/labels for Google Drive
const target2 = 'label="Đường dẫn ảnh gốc (Link ảnh)"';
const replacement2 = 'label="Đường dẫn ảnh gốc (Google Drive / Photos)"';

const target3 = 'label="Đường dẫn ảnh chỉnh sửa (Link ảnh)"';
const replacement3 = 'label="Đường dẫn ảnh chỉnh sửa (Google Drive / Photos)"';

const target4 = 'placeholder="https://drive.google.com/..."';
const replacement4 = 'placeholder="Google Drive hoặc Google Photos link..."';

console.log("Checking target 1 count:", content.split(target1).length - 1);
console.log("Checking target 2 count:", content.split(target2).length - 1);
console.log("Checking target 3 count:", content.split(target3).length - 1);
console.log("Checking target 4 count:", content.split(target4).length - 1);

content = content.replace(target1, replacement1);
content = content.split(target2).join(replacement2);
content = content.split(target3).join(replacement3);
content = content.split(target4).join(replacement4);

fs.writeFileSync(filePath, content, 'utf8');
console.log("LichCuaHang.js updated successfully.");
