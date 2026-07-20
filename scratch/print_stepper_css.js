const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/ThemHopDongDialog.css', 'utf8');

const lines = content.replace(/\r/g, '').split('\n');
for (let i = 290; i <= 320; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
