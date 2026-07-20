const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/ThemHopDongKHDialog.js', 'utf8');

const lines = content.replace(/\r/g, '').split('\n');
for (let i = 1320; i <= 1380; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
