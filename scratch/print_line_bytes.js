const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js', 'utf8');

const lines = content.replace(/\r/g, '').split('\n');
for (let i = 1530; i <= 1540; i++) {
  console.log(`Line ${i}:`, JSON.stringify(lines[i - 1]));
}
