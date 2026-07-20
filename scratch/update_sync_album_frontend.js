const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js';

let content = fs.readFileSync(filePath, 'utf8');

// Let's use a regex to target the then block inside handleSyncAlbum
const targetRegex = /\.then\(res\s*=>\s*\{([\s\S]*?)toast\.success\(res\.message\s*\|\|\s*"Đồng bộ album thành công!"\);([\s\S]*?)if\s*\(res\.album\)/;

console.log("Regex matches target:", targetRegex.test(content));

// We want to replace:
// .then(res => {
//     toast.success(res.message || "Đồng bộ album thành công!");
//     if (res.album) {
// With:
// .then(res => {
//     toast.success(res.message || "Đồng bộ album thành công!");
//     if (loaiAnh === 'goc') {
//         setLinkAnhGoc(link.trim());
//     } else {
//         setLinkAnhChinhSua(link.trim());
//     }
//     if (res.album) {

content = content.replace(/\.then\(res\s*=>\s*\{\s*toast\.success\(res\.message\s*\|\|\s*"Đồng bộ album thành công!"\);/g, (match) => {
  return `.then(res => {
                toast.success(res.message || "Đồng bộ album thành công!");
                if (loaiAnh === 'goc') {
                    setLinkAnhGoc(link.trim());
                } else {
                    setLinkAnhChinhSua(link.trim());
                }`;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log("DetailHopDongKhachHangDialog.js modified successfully with link update logic.");
