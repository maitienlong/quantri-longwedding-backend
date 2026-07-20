const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js';

let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings
content = content.replace(/\r/g, '');

// Target 1: Box 3 (ĐỒNG BỘ ẢNH GỐC)
const targetBoxGoc = `                                                        {/* Box 3: Sync stats (Original) */}
                                                        <Box p={1.5} bgcolor="#ffffff" border="1px solid #e2e8f0" borderRadius="8px" display="flex" flexDirection="column" gap={0.5}>
                                                            <Typography variant="caption" style={{ color: '#64748b', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.5px' }}>ĐỒNG BỘ ẢNH GỐC</Typography>`;

const replacementBoxGoc = `                                                        {/* Box 3: Sync stats (Original) */}
                                                        <Box 
                                                            p={1.5} 
                                                            bgcolor="#ffffff" 
                                                            border="1px solid #e2e8f0" 
                                                            borderRadius="8px" 
                                                            display="flex" 
                                                            flexDirection="column" 
                                                            gap={0.5}
                                                            onClick={() => {
                                                                 if (linkAnhGoc) {
                                                                     window.open(linkAnhGoc, '_blank');
                                                                 } else {
                                                                     toast.warning("Hợp đồng chưa có đường dẫn ảnh gốc.");
                                                                 }
                                                             }}
                                                             style={{ cursor: 'pointer' }}
                                                         >
                                                            <Typography variant="caption" style={{ color: '#64748b', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.5px' }}>ĐỒNG BỘ ẢNH GỐC</Typography>`;

console.log("[boxGoc] Match found:", content.includes(targetBoxGoc));
content = content.replace(targetBoxGoc, replacementBoxGoc);

// Target 2: Box 4 (ĐỒNG BỘ ẢNH C.SỬA)
const targetBoxChinhSua = `                                                        {/* Box 4: Sync stats (Edited) */}
                                                        <Box p={1.5} bgcolor="#ffffff" border="1px solid #e2e8f0" borderRadius="8px" display="flex" flexDirection="column" gap={0.5}>
                                                            <Typography variant="caption" style={{ color: '#64748b', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.5px' }}>ĐỒNG BỘ ẢNH C.SỬA</Typography>`;

const replacementBoxChinhSua = `                                                        {/* Box 4: Sync stats (Edited) */}
                                                        <Box 
                                                            p={1.5} 
                                                            bgcolor="#ffffff" 
                                                            border="1px solid #e2e8f0" 
                                                            borderRadius="8px" 
                                                            display="flex" 
                                                            flexDirection="column" 
                                                            gap={0.5}
                                                            onClick={() => {
                                                                 if (linkAnhChinhSua) {
                                                                     window.open(linkAnhChinhSua, '_blank');
                                                                 } else {
                                                                     toast.warning("Hợp đồng chưa có đường dẫn ảnh chỉnh sửa.");
                                                                 }
                                                             }}
                                                             style={{ cursor: 'pointer' }}
                                                         >
                                                            <Typography variant="caption" style={{ color: '#64748b', fontWeight: 700, fontSize: '0.7rem', letterSpacing: '0.5px' }}>ĐỒNG BỘ ẢNH C.SỬA</Typography>`;

console.log("[boxChinhSua] Match found:", content.includes(targetBoxChinhSua));
content = content.replace(targetBoxChinhSua, replacementBoxChinhSua);

// Convert back to CRLF
content = content.split('\n').join('\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log("DetailHopDongKhachHangDialog.js finished.");
