const fs = require('fs');

const filePath = 'D:/LONG WEDDING/HETHONG CNTT/quantri-longwedding/src/screens/HopDong/ThemHopDongKHDialog.js';

let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings
content = content.replace(/\r/g, '');

const target = `                                        <div className="floating-label" style={{ marginTop: '0px' }}>
                                            <input type="text" name="diaDiemChup" value={diaDiemChup} onChange={(e) => setDiaDiemChup(e.target.value)} />
                                            <label>Địa điểm chụp</label>
                                        </div>
                                    </div>`;

const replacement = `                                        <div className="floating-label" style={{ marginTop: '0px' }}>
                                            <input type="text" name="diaDiemChup" value={diaDiemChup} onChange={(e) => setDiaDiemChup(e.target.value)} />
                                            <label>Địa điểm chụp</label>
                                        </div>

                                        <div className="floating-label" style={{ marginTop: '5px' }}>
                                            <input type="date" name="ngayTraAnh" value={ngayTraAnh} onChange={(e) => setNgayTraAnh(e.target.value)} />
                                            <label>Ngày trả ảnh</label>
                                        </div>
                                        {ngayTraAnh && (
                                            <div style={{ fontSize: '0.78rem', color: '#e67e22', marginTop: '-10px', marginLeft: '4px', fontWeight: '500', marginBottom: '10px' }}>
                                                Âm lịch: {formatLunarDateFull(ngayTraAnh)}
                                            </div>
                                        )}
                                    </div>`;

console.log("[dialogInput] Match found:", content.includes(target));
content = content.replace(target, replacement);

// Convert back to CRLF
content = content.split('\n').join('\r\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log("ThemHopDongKHDialog.js finished.");
