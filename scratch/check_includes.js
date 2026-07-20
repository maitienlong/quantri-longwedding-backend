const fs = require('fs');
const content = fs.readFileSync('D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js', 'utf8').replace(/\r/g, '');

const line1 = '                    setAlbumData(res.album);';
const line2 = '                    setCoGioiHanAnh(res.album.coGioiHanAnh || false);';

const index = content.indexOf(line1);
if (index !== -1) {
  console.log("Characters following line 1 (as JSON):", JSON.stringify(content.substring(index, index + 200)));
}
console.log("line1 + line2 in content:", content.includes(line1 + '\n' + line2));
