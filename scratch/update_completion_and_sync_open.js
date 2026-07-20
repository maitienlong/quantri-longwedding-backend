const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js';

let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings
content = content.replace(/\r/g, '');

// 1. Update Step 5 validation in handleStepClick
const targetStep5 = `        } else if (stepNumber === 5) {
            if (window.confirm("Bạn có muốn chuyển tiến trình hợp đồng sang \\"Hoàn thành\\" không?")) {
                submitProgressUpdate(5, {});
            }
        }`;

const replacementStep5 = `        } else if (stepNumber === 5) {
            if (!linkAnhGoc || !linkAnhChinhSua) {
                toast.error("Không thể hoàn thành hợp đồng. Vui lòng bổ sung đầy đủ đường dẫn ảnh gốc và ảnh chỉnh sửa!");
                return;
            }
            if (window.confirm("Bạn có muốn chuyển tiến trình hợp đồng sang \\"Hoàn thành\\" không?")) {
                submitProgressUpdate(5, {});
            }
        }`;

console.log("[step5] Match found:", content.includes(targetStep5));
content = content.replace(targetStep5, replacementStep5);

// 2. Update Sync original photos onClick to open the link in a new tab
const targetSyncGoc = `                                                            onClick={() => handleSyncAlbum(linkAnhGoc, 'goc')}`;
const replacementSyncGoc = `                                                            onClick={() => {
                                                                window.open(linkAnhGoc, '_blank');
                                                                handleSyncAlbum(linkAnhGoc, 'goc');
                                                            }}`;

console.log("[syncGoc] Match found:", content.includes(targetSyncGoc));
content = content.replace(targetSyncGoc, replacementSyncGoc);

// 3. Update Sync edited photos onClick to open the link in a new tab
const targetSyncChinhSua = `                                                            onClick={() => handleSyncAlbum(linkAnhChinhSua, 'chinhSua')}`;
const replacementSyncChinhSua = `                                                            onClick={() => {
                                                                window.open(linkAnhChinhSua, '_blank');
                                                                handleSyncAlbum(linkAnhChinhSua, 'chinhSua');
                                                            }}`;

console.log("[syncChinhSua] Match found:", content.includes(targetSyncChinhSua));
content = content.replace(targetSyncChinhSua, replacementSyncChinhSua);

// Convert back to CRLF
content = content.split('\n').join('\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log("DetailHopDongKhachHangDialog.js finished.");
