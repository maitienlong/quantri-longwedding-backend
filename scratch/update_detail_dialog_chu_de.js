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

// 4. Add TextField in JSX right after the Special Collection Box closing tag
const jsxRegex = /<Switch[\s\S]*?checked=\{isSpecialCollection\}[\s\S]*?\/>\s*<\/Box>/g;

console.log("Regex match test:", content.match(jsxRegex) !== null);

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
console.log("DetailHopDongKhachHangDialog.js modified successfully.");
