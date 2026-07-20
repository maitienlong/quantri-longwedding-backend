const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js';

let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings
content = content.replace(/\r/g, '');

const regexGoc = /onClick=\{\(\)\s*=>\s*\{\s*window\.open\(linkAnhGoc,\s*'_blank'\);\s*handleSyncAlbum\(linkAnhGoc,\s*'goc'\);\s*\}\}/g;
console.log("[revertGoc] Match found:", regexGoc.test(content));
content = content.replace(regexGoc, "onClick={() => handleSyncAlbum(linkAnhGoc, 'goc')}");

const regexChinhSua = /onClick=\{\(\)\s*=>\s*\{\s*window\.open\(linkAnhChinhSua,\s*'_blank'\);\s*handleSyncAlbum\(linkAnhChinhSua,\s*'chinhSua'\);\s*\}\}/g;
console.log("[revertChinhSua] Match found:", regexChinhSua.test(content));
content = content.replace(regexChinhSua, "onClick={() => handleSyncAlbum(linkAnhChinhSua, 'chinhSua')}");

// Convert back to CRLF
content = content.split('\n').join('\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log("DetailHopDongKhachHangDialog.js finished.");
