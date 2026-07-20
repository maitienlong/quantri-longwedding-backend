const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js', 'utf8');

const lines = content.replace(/\r/g, '').split('\n');
for (let i = 1400; i <= 1438; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
