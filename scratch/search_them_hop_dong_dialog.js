const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/ThemHopDongKHDialog.js', 'utf8');

const lines = content.replace(/\r/g, '').split('\n');
console.log("Searching for fields and dates in ThemHopDongKHDialog.js...");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('ngayCuoi') || line.includes('NgayCuoi') || line.includes('Ngày cưới') || line.includes('DatePicker') || line.includes('DateTimePicker') || line.includes('input') || line.includes('state') || line.includes('useState')) {
    console.log(`Line ${i + 1}: ${line.trim()}`);
  }
}
