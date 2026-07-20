const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/ThemHopDongKHDialog.js', 'utf8').replace(/\r/g, '');

const lines = content.split('\n');
console.log("Checking ThemHopDongKHDialog lines 1355 to 1365:");
for (let i = 1355; i <= 1365; i++) {
  console.log(`${i}: ${JSON.stringify(lines[i - 1])}`);
}
