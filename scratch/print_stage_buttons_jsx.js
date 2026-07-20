const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js', 'utf8');

const lines = content.replace(/\r/g, '').split('\n');
for (let i = 1515; i <= 1570; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
