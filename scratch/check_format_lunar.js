const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/ThemHopDongKHDialog.js', 'utf8');

console.log("formatLunarDateFull exists:", content.includes('formatLunarDateFull'));
