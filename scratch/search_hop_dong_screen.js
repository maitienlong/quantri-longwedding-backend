const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/HopDongKhachHang.js', 'utf8');

const lines = content.replace(/\r/g, '').split('\n');
console.log("Searching for keywords in HopDongKhachHang.js...");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('ngayTraAnh') || line.includes('Ngày trả ảnh') || line.includes('openCreate') || line.includes('dialog') || line.includes('Dialog') || line.includes('createHopDong')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
}
