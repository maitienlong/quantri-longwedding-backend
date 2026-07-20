const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/backend-quantri-longwedding/backend-admin-longwedding/src/services/website.service.js';

let content = fs.readFileSync(filePath, 'utf8');

const targetPattern = `            const list = (album.danhSachAnhChinhSua && album.danhSachAnhChinhSua.length > 0)
              ? album.danhSachAnhChinhSua
              : (album.danhSachAnh || []);`;

// We will replace this pattern to match both \r\n and \n line endings
// Let's verify how many times it occurs in the file
// We will use a regex to replace it
const regexPattern = /const\s+list\s*=\s*\(album\.danhSachAnhChinhSua\s*&&\s*album\.danhSachAnhChinhSua\.length\s*>\s*0\)\s*\?\s*album\.danhSachAnhChinhSua\s*:\s*\(album\.danhSachAnh\s*\|\|\s*\[\]\);/g;

const matches = content.match(regexPattern);
console.log(`Found ${matches ? matches.length : 0} occurrences of target pattern.`);

content = content.replace(regexPattern, 'const list = album.danhSachAnhChinhSua || [];');

fs.writeFileSync(filePath, content, 'utf8');
console.log("website.service.js updated successfully.");
