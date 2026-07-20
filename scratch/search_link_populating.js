const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js', 'utf8');

const lines = content.replace(/\r/g, '').split('\n');
console.log("Searching for setLinkAnhGoc...");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('setLinkAnhGoc')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
}
