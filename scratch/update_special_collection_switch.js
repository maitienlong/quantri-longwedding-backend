const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js';

let content = fs.readFileSync(filePath, 'utf8');

// 1. Add state variable
const stateTarget = 'const [isSpecialCollection, setIsSpecialCollection] = useState(false);';
const stateReplacement = 'const [isSpecialCollection, setIsSpecialCollection] = useState(false);\n    const [chuDe, setChuDe] = useState("");';
content = content.replace(stateTarget, stateReplacement);

// 2. Add setChuDe in both fetchAlbumData and handleSyncAlbum by replacing the common line
content = content.replace(/setKhachHangXacNhan\(res\.album\.khachHangXacNhan\s*\|\|\s*false\);/g, (match) => {
  return match + '\n                    setChuDe(res.album.chuDe || "");';
});

// 3. Add chuDe to updateAlbumSettings call
const saveTarget = 'otherService.updateAlbumSettings(data?.maHopDong, { coGioiHanAnh, soLuongAnhGioiHan, khachHangXacNhan, isSpecialCollection })';
const saveReplacement = 'otherService.updateAlbumSettings(data?.maHopDong, { coGioiHanAnh, soLuongAnhGioiHan, khachHangXacNhan, isSpecialCollection, chuDe })';
content = content.replace(saveTarget, saveReplacement);

// 4. Update the isSpecialCollection switch onChange handler
// We anchor on "Bộ sưu tập đặc biệt" to avoid matching previous switches
const switchRegex = /Bộ sưu tập đặc biệt<\/Typography>[\s\S]*?<Switch[\s\S]*?checked=\{isSpecialCollection\}[\s\S]*?onChange=\{\(e\)\s*=>\s*setIsSpecialCollection\(e\.target\.checked\)\}[\s\S]*?\/>/g;

console.log("Switch target match:", content.match(switchRegex) !== null);

const replacement = `Bộ sưu tập đặc biệt</Typography>
                                                                    <Typography variant="caption" style={{ color: '#64748b', fontSize: '0.72rem' }}>Hiển thị hình ảnh album này lên trang chủ & trang bộ sưu tập</Typography>
                                                                </Box>
                                                                <Switch
                                                                     checked={isSpecialCollection}
                                                                     onChange={(e) => {
                                                                         const checked = e.target.checked;
                                                                         if (checked && !linkAnhChinhSua) {
                                                                             toast.warning("Hợp đồng chưa có đường dẫn ảnh chỉnh sửa. Vui lòng bổ sung trước.");
                                                                             return;
                                                                         }
                                                                         setIsSpecialCollection(checked);
                                                                     }}
                                                                     color="info"
                                                                     size="small"
                                                                 />`;

content = content.replace(switchRegex, replacement);

// 5. Add TextField in JSX right after the Special Collection Box closing tag
const jsxRegex = /<Switch[\s\S]*?checked=\{isSpecialCollection\}[\s\S]*?color="info"[\s\S]*?\/>\s*<\/Box>/g;
console.log("JSX target match:", content.match(jsxRegex) !== null);

content = content.replace(jsxRegex, (match) => {
  return match + `

                                                            {/* Setting 4: Theme / Concept */}
                                                            <Box display="flex" flexDirection="column" gap={1} mt={1.5} pt={1.5} borderTop="1px solid #f1f5f9">
                                                                <Typography variant="body2" style={{ fontWeight: 600, color: '#334155', fontSize: '0.82rem' }}>Chủ đề / Concept của Album</Typography>
                                                                <TextField
                                                                    placeholder="Ví dụ: Concept Studio nhẹ nhàng, Concept Cổ phục Hàn Quốc, ..."
                                                                    fullWidth
                                                                    size="small"
                                                                    variant="outlined"
                                                                    value={chuDe}
                                                                    onChange={(e) => setChuDe(e.target.value)}
                                                                    inputProps={{ style: { fontSize: '0.82rem' } }}
                                                                />
                                                            </Box>`;
});

fs.writeFileSync(filePath, content, 'utf8');
console.log("DetailHopDongKhachHangDialog.js updated successfully.");
