const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/DetailHopDongKhachHangDialog.js';

let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings by removing \r completely
content = content.replace(/\r/g, '');

// 1. Add state variable
content = content.replace(
  'const [isSpecialCollection, setIsSpecialCollection] = useState(false);',
  'const [isSpecialCollection, setIsSpecialCollection] = useState(false);\n    const [chuDe, setChuDe] = useState("");'
);

// 2. Add setChuDe in fetchAlbumData and handleSyncAlbum
const targetBlock1 = 
  '                    setAlbumData(res.album);\n' +
  '                    setCoGioiHanAnh(res.album.coGioiHanAnh || false);\n' +
  '                    setSoLuongAnhGioiHan(res.album.soLuongAnhGioiHan || 0);\n' +
  '                    setKhachHangXacNhan(res.album.khachHangXacNhan || false);';

const replacementBlock1 = 
  '                    setAlbumData(res.album);\n' +
  '                    setCoGioiHanAnh(res.album.coGioiHanAnh || false);\n' +
  '                    setSoLuongAnhGioiHan(res.album.soLuongAnhGioiHan || 0);\n' +
  '                    setKhachHangXacNhan(res.album.khachHangXacNhan || false);\n' +
  '                    setChuDe(res.album.chuDe || "");';

console.log("[block1] Match found:", content.includes(targetBlock1));
content = content.split(targetBlock1).join(replacementBlock1);

// 3. Add link updates in handleSyncAlbum then block
const targetBlock2 = 
  '        otherService.syncAlbum({ maHopDong: data.maHopDong, driveLink: link.trim(), loaiAnh })\n' +
  '            .then(res => {\n' +
  '                toast.success(res.message || "Đồng bộ album thành công!");\n' +
  '                if (res.album) {';

const replacementBlock2 = 
  '        otherService.syncAlbum({ maHopDong: data.maHopDong, driveLink: link.trim(), loaiAnh })\n' +
  '            .then(res => {\n' +
  '                toast.success(res.message || "Đồng bộ album thành công!");\n' +
  '                if (loaiAnh === \'goc\') {\n' +
  '                    setLinkAnhGoc(link.trim());\n' +
  '                } else {\n' +
  '                    setLinkAnhChinhSua(link.trim());\n' +
  '                }\n' +
  '                if (res.album) {';

console.log("[block2] Match found:", content.includes(targetBlock2));
content = content.replace(targetBlock2, replacementBlock2);

// 4. Add chuDe to updateAlbumSettings call
const targetSave = 'otherService.updateAlbumSettings(data?.maHopDong, { coGioiHanAnh, soLuongAnhGioiHan, khachHangXacNhan, isSpecialCollection })';
const replacementSave = 'otherService.updateAlbumSettings(data?.maHopDong, { coGioiHanAnh, soLuongAnhGioiHan, khachHangXacNhan, isSpecialCollection, chuDe })';
console.log("[save] Match found:", content.includes(targetSave));
content = content.replace(targetSave, replacementSave);

// 5. Update the isSpecialCollection switch and add TextField
const targetBlock3 = 
  '                                                            {/* Setting 3: Special Collection */}\n' +
  '                                                            <Box display="flex" alignItems="center" justifyContent="space-between">\n' +
  '                                                                <Box>\n' +
  '                                                                    <Typography variant="body2" style={{ fontWeight: 600, color: \'#334155\', fontSize: \'0.82rem\' }}>Bộ sưu tập đặc biệt</Typography>\n' +
  '                                                                    <Typography variant="caption" style={{ color: \'#64748b\', fontSize: \'0.72rem\' }}>Hiển thị hình ảnh album này lên trang chủ & trang bộ sưu tập</Typography>\n' +
  '                                                                </Box>\n' +
  '                                                                <Switch\n' +
  '                                                                    checked={isSpecialCollection}\n' +
  '                                                                    onChange={(e) => setIsSpecialCollection(e.target.checked)}\n' +
  '                                                                    color="info"\n' +
  '                                                                    size="small"\n' +
  '                                                                />\n' +
  '                                                            </Box>';

const replacementBlock3 = 
  '                                                            {/* Setting 3: Special Collection */}\n' +
  '                                                            <Box display="flex" alignItems="center" justifyContent="space-between">\n' +
  '                                                                <Box>\n' +
  '                                                                    <Typography variant="body2" style={{ fontWeight: 600, color: \'#334155\', fontSize: \'0.82rem\' }}>Bộ sưu tập đặc biệt</Typography>\n' +
  '                                                                    <Typography variant="caption" style={{ color: \'#64748b\', fontSize: \'0.72rem\' }}>Hiển thị hình ảnh album này lên trang chủ & trang bộ sưu tập</Typography>\n' +
  '                                                                </Box>\n' +
  '                                                                <Switch\n' +
  '                                                                     checked={isSpecialCollection}\n' +
  '                                                                     onChange={(e) => {\n' +
  '                                                                         const checked = e.target.checked;\n' +
  '                                                                         if (checked && !linkAnhChinhSua) {\n' +
  '                                                                             toast.warning("Hợp đồng chưa có đường dẫn ảnh chỉnh sửa. Vui lòng bổ sung trước.");\n' +
  '                                                                             return;\n' +
  '                                                                         }\n' +
  '                                                                         setIsSpecialCollection(checked);\n' +
  '                                                                     }}\n' +
  '                                                                     color="info"\n' +
  '                                                                     size="small"\n' +
  '                                                                 />\n' +
  '                                                            </Box>\n\n' +
  '                                                            {/* Setting 4: Theme / Concept */}\n' +
  '                                                            <Box display="flex" flexDirection="column" gap={1} mt={1.5} pt={1.5} borderTop="1px solid #f1f5f9">\n' +
  '                                                                <Typography variant="body2" style={{ fontWeight: 600, color: \'#334155\', fontSize: \'0.82rem\' }}>Chủ đề / Concept của Album</Typography>\n' +
  '                                                                <TextField\n' +
  '                                                                    placeholder="Ví dụ: Concept Studio nhẹ nhàng, Concept Cổ phục Hàn Quốc, ..."\n' +
  '                                                                    fullWidth\n' +
  '                                                                    size="small"\n' +
  '                                                                    variant="outlined"\n' +
  '                                                                    value={chuDe}\n' +
  '                                                                    onChange={(e) => setChuDe(e.target.value)}\n' +
  '                                                                    inputProps={{ style: { fontSize: ' + "'0.82rem'" + ' } }}\n' +
  '                                                                />\n' +
  '                                                            </Box>';

console.log("[block3] Match found:", content.includes(targetBlock3));
content = content.replace(targetBlock3, replacementBlock3);

// Convert back to CRLF
content = content.split('\n').join('\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log("DetailHopDongKhachHangDialog.js finished.");
