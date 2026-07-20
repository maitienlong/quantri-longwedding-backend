const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js';

let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings
content = content.replace(/\r/g, '');

// 1. Set link states when loading existing contract
const targetInit = `            setNhanVienSale(data.nhanVienSale || "0");
            setGiaiDoan(data.giaiDoan || 1);
            setDichVuChinh(data.dichVuChinh || 0);
            setIsSpecialCollection(data.isSpecialCollection || false);`;

const replacementInit = `            setNhanVienSale(data.nhanVienSale || "0");
            setGiaiDoan(data.giaiDoan || 1);
            setDichVuChinh(data.dichVuChinh || 0);
            setIsSpecialCollection(data.isSpecialCollection || false);
            setLinkAnhGoc(data.linkAnhGoc || "");
            setLinkAnhChinhSua(data.linkAnhChinhSua || "");`;

console.log("[init] Match found:", content.includes(targetInit));
content = content.replace(targetInit, replacementInit);

// 2. Reset link states when initializing form
const targetReset = `            setAlbumData(null);
            resetForm();`;

const replacementReset = `            setAlbumData(null);
            setLinkAnhGoc("");
            setLinkAnhChinhSua("");
            resetForm();`;

console.log("[reset] Match found:", content.includes(targetReset));
content = content.replace(targetReset, replacementReset);

// Convert back to CRLF
content = content.split('\n').join('\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log("DetailHopDongKhachHangDialog.js updated with link initialization.");
