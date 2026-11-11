
// Helper giải mã và tối ưu hóa Base64 thành tệp ảnh WebP tĩnh trên máy chủ
const saveBase64ImageFile = async (base64String, prefix = 'img', host = '') => {
    if (!base64String || typeof base64String !== 'string') return base64String;
    if (base64String.startsWith('http://') || base64String.startsWith('https://') || base64String.startsWith('/uploads/')) {
        return base64String;
    }

    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let buffer;
    if (matches && matches.length === 3) {
        buffer = Buffer.from(matches[2], 'base64');
    } else if (base64String.length > 200 && !base64String.includes(' ') && !base64String.includes('\n')) {
        try {
            buffer = Buffer.from(base64String, 'base64');
        } catch (e) {
            return base64String;
        }
    } else {
        return base64String;
    }

    if (!buffer || buffer.length === 0) return base64String;

    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1E6)}.webp`;
    const destPath = path.join(uploadDir, filename);

    try {
        const sharp = require('sharp');
        await sharp(buffer)
            .rotate()
            .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 90, effort: 4 })
            .toFile(destPath);
    } catch (err) {
        console.warn("Sharp error on base64 image, saving buffer directly:", err.message);
        fs.writeFileSync(destPath, buffer);
    }

    const relativePath = `/uploads/${filename}`;
    if (host) {
        return `${host.replace(/\/$/, '')}${relativePath}`;
    }
    return relativePath;
};

const fs = require("fs");
const path = require("path");
const ThiepCuoi = require("../models/thiepCuoi.model");
const KhachHang = require("../models/khachHang.model");
const HopDong = require("../models/hopDong.model");
const { success, error } = require("../utils/response");


function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str;
}

function generateSlugFromNames(groom, bride) {
    const cleanG = removeVietnameseTones(groom || '').trim().toLowerCase().split(/\s+/).pop();
    const cleanB = removeVietnameseTones(bride || '').trim().toLowerCase().split(/\s+/).pop();
    if (cleanG && cleanB) return `${cleanG}-${cleanB}`;
    const fullG = removeVietnameseTones(groom || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    const fullB = removeVietnameseTones(bride || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
    if (fullG || fullB) return `${fullG || ''}-${fullB || ''}`.replace(/^-+|-+$/g, '').replace(/-+/g, '-');
    return `wedding-${Date.now().toString(36)}`;
}

async function findInvitationByAnyId(id) {
    if (!id) return null;
    const cleanId = String(id).trim();
    const cleanLower = cleanId.toLowerCase();
    
    // 1. Tìm chính xác theo invitationId, shortCode, customSlug, slug hoặc _id
    let invitation = await ThiepCuoi.findOne({
        $or: [
            { invitationId: cleanId },
            { shortCode: cleanLower },
            { customSlug: cleanLower },
            { slug: cleanLower },
            ...(cleanId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: cleanId }] : [])
        ]
    });

    if (invitation) return invitation;

    // 2. Tìm mềm: số hợp đồng hoặc tên
    const safeRegex = cleanLower.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const queries = [
        { invitationId: new RegExp(safeRegex, 'i') },
        { customSlug: new RegExp(`^${safeRegex}$`, 'i') },
        { shortCode: cleanLower }
    ];
    if (/^\d+$/.test(cleanLower)) {
        queries.push({ invitationId: new RegExp(`hd[-_]?\\d*[-_]?${cleanLower}`, 'i') });
    }

    return await ThiepCuoi.findOne({ $or: queries });
}

// 1. Lấy thông tin thiệp cưới theo invitationId
exports.getInvitationById = async (req, res) => {
    try {
        const { id } = req.params;
        let invitation = await findInvitationByAnyId(id);

        if (!invitation) {
            return error(res, "Không tìm thấy thiệp cưới", 404);
        }

        return success(res, "Lấy thông tin thiệp cưới thành công", invitation);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 2. Lấy thiệp cưới của khách hàng đang đăng nhập hoặc theo ID khách hàng
exports.getMyInvitation = async (req, res) => {
    try {
        const customerId = req.user?.id || req.params.customerId;
        if (!customerId) {
            return error(res, "Vui lòng đăng nhập tài khoản khách hàng", 401);
        }

        let invitation = await ThiepCuoi.findOne({ khachHangId: customerId });
        
        // Nếu chưa có thiệp cưới nhưng có hợp đồng, tự động nạp thông tin từ Hợp Đồng Studio
        if (!invitation) {
            const hopDong = await HopDong.findOne({
                $or: [{ khachHang1: customerId }, { khachHang2: customerId }]
            }).populate("khachHang1").populate("khachHang2");

            const khachHang = await KhachHang.findById(customerId);

            let initialData = {
                invitationId: `thiep-${khachHang ? khachHang.soDienThoai || khachHang.maDangNhap || customerId : customerId}`,
                khachHangId: customerId,
                title: `Thiệp Cưới: ${khachHang ? khachHang.tenKhachHang : 'Dâu Rể'}`,
                groom: {
                    name: hopDong?.khachHang1?.tenKhachHang || (khachHang?.gioiTinh === 'Nam' ? khachHang.tenKhachHang : ''),
                    phone: hopDong?.khachHang1?.soDienThoai || (khachHang?.gioiTinh === 'Nam' ? khachHang.soDienThoai : ''),
                    avatar: hopDong?.khachHang1?.avatar || (khachHang?.gioiTinh === 'Nam' ? khachHang.avatar : '')
                },
                bride: {
                    name: hopDong?.khachHang2?.tenKhachHang || (khachHang?.gioiTinh === 'Nữ' ? khachHang.tenKhachHang : ''),
                    phone: hopDong?.khachHang2?.soDienThoai || (khachHang?.gioiTinh === 'Nữ' ? khachHang.soDienThoai : ''),
                    avatar: hopDong?.khachHang2?.avatar || (khachHang?.gioiTinh === 'Nữ' ? khachHang.avatar : '')
                },
                guestList: [],
                rsvps: [],
                wishes: []
            };

            if (hopDong) {
                initialData.maHopDong = hopDong.maHopDong;
                if (hopDong.cacNgay?.ngayCuoi) {
                    const dateStr = new Date(hopDong.cacNgay.ngayCuoi).toISOString().split('T')[0];
                    initialData.tiecCuoi = {
                        enabled: true,
                        title: 'TIỆC MỪNG TRỌNG ĐẠI',
                        time: '17:30',
                        dateSolar: dateStr,
                        locationName: hopDong.cacNgay.diaDiemChup || 'Trung Tâm Tiệc Cưới',
                        address: 'Nghệ An'
                    };
                }
            }

            return success(res, "Khởi tạo dữ liệu từ tài khoản khách hàng", initialData);
        }

        return success(res, "Lấy thiệp cưới thành công", invitation);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 3. Lưu hoặc Cập nhật thiệp cưới (Upsert)
exports.saveInvitation = async (req, res) => {
    try {
        const data = req.body;
        const host = (req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : req.protocol) + '://' + req.get('host');

        // Tự động giải mã & tối ưu hóa mọi trường ảnh Base64 trong payload thiệp cưới
        if (data.mainPhoto && typeof data.mainPhoto === 'string' && data.mainPhoto.startsWith('data:image')) {
            data.mainPhoto = await saveBase64ImageFile(data.mainPhoto, 'main', host);
        }

        if (data.groom) {
            if (data.groom.avatar && typeof data.groom.avatar === 'string' && data.groom.avatar.startsWith('data:image')) {
                data.groom.avatar = await saveBase64ImageFile(data.groom.avatar, 'groom', host);
            }
            if (data.groom.qrCode && typeof data.groom.qrCode === 'string' && data.groom.qrCode.startsWith('data:image')) {
                data.groom.qrCode = await saveBase64ImageFile(data.groom.qrCode, 'qr-groom', host);
            }
        }

        if (data.bride) {
            if (data.bride.avatar && typeof data.bride.avatar === 'string' && data.bride.avatar.startsWith('data:image')) {
                data.bride.avatar = await saveBase64ImageFile(data.bride.avatar, 'bride', host);
            }
            if (data.bride.qrCode && typeof data.bride.qrCode === 'string' && data.bride.qrCode.startsWith('data:image')) {
                data.bride.qrCode = await saveBase64ImageFile(data.bride.qrCode, 'qr-bride', host);
            }
        }

        if (Array.isArray(data.gallery)) {
            data.gallery = await Promise.all(data.gallery.map(async (img) => {
                if (typeof img === 'string' && img.startsWith('data:image')) {
                    return await saveBase64ImageFile(img, 'gallery', host);
                }
                return img;
            }));
        }

        if (Array.isArray(data.guestList)) {
            data.guestList = await Promise.all(data.guestList.map(async (guest) => {
                if (guest && guest.avatar && typeof guest.avatar === 'string' && guest.avatar.startsWith('data:image')) {
                    const savedAvatar = await saveBase64ImageFile(guest.avatar, 'guest', host);
                    return { ...guest, avatar: savedAvatar };
                }
                return guest;
            }));
        }
        // Tự động sinh shortCode và customSlug nếu chưa có
        if (!data.shortCode && data.invitationId) {
            const m = data.invitationId.match(/hd[-_]?\d*[-_]?(\d+)/i);
            if (m && m[1]) data.shortCode = m[1];
        }
        if (!data.customSlug && (data.groom?.name || data.bride?.name)) {
            data.customSlug = generateSlugFromNames(data.groom?.name, data.bride?.name);
        }
        const customerId = req.user?.id || data.khachHangId;

        if (!data.invitationId) {
            data.invitationId = `thiep-${Date.now()}`;
        }

        if (customerId) {
            data.khachHangId = customerId;
        }

        if (!customerId) {
            return error(res, "Bắt buộc phải đăng nhập tài khoản khách hàng để lưu thiệp cưới!", 401);
        }

        // MOD-11: Owner Policy check when updating existing invitation
        const role = req.user?.positon || req.user?.role;
        const isManager = req.user?.username === 'along' || role === 'Quản lý' || role === 'Admin' || role === 'Quản trị viên' || req.user?.permission === 1;
        let existingInvitation = null;
        if (data.invitationId) {
            existingInvitation = await ThiepCuoi.findOne({ invitationId: data.invitationId });
            if (existingInvitation) {
                const userIdStr = String(req.user?.id || req.user?._id || '');
                const username = String(req.user?.username || '');
                const cId = String(req.user?.customerId || '');
                const isOwner = (
                    (existingInvitation.createdBy && String(existingInvitation.createdBy) === userIdStr) ||
                    (existingInvitation.creator && existingInvitation.creator.toLowerCase() === username.toLowerCase()) ||
                    (existingInvitation.khachHangId && (String(existingInvitation.khachHangId) === cId || String(existingInvitation.khachHangId) === userIdStr)) ||
                    (existingInvitation.customerId && (String(existingInvitation.customerId) === cId || String(existingInvitation.customerId) === userIdStr || String(existingInvitation.customerId) === username))
                );
                if (!isManager && !isOwner) {
                    return error(res, "Bạn không có quyền chỉnh sửa thiệp cưới của khách hàng khác (Owner Policy)", 403);
                }
            }
        }

        if (!data.createdBy && req.user) {
            data.createdBy = req.user.id || req.user._id;
            data.creator = req.user.username || "Client";
        }
        data.customerId = String(customerId);

        // Kiểm tra điều kiện đơn hàng có dịch vụ thiệp mời online cùng mã loại thiệp (trừ khi Admin thao tác hoặc đã được overridePermission)
        const templateId = data.templateId || data.themeId;
        const hasAdminOverride = isManager || existingInvitation?.overridePermission === true;
        if (!hasAdminOverride) {
            const eligibility = await validateCustomerInvitationEligibility(customerId, templateId);
            if (!eligibility.allowed) {
                return error(res, eligibility.reason || "Đơn hàng của bạn không đủ điều kiện tạo thiệp cưới này!", 403);
            }
        }

        let updated = await ThiepCuoi.findOneAndUpdate(
            { 
                khachHangId: customerId,
                ...(data.invitationId ? { invitationId: data.invitationId } : {})
            },
            { $set: data },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return success(res, "Lưu thiệp cưới và danh sách khách mời thành công!", updated);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 4. Lấy danh bạ khách hàng thật từ Studio để chọn mời
exports.getStudioContacts = async (req, res) => {
    try {
        const contacts = await KhachHang.find({}, {
            tenKhachHang: 1,
            soDienThoai: 1,
            diaChi: 1,
            avatar: 1,
            facebookId: 1
        }).sort({ createdAt: -1 }).limit(100);

        return success(res, "Lấy danh bạ khách hàng studio thành công", contacts);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 5. Thêm/Cập nhật một khách mời thật vào thiệp
exports.addOrUpdateGuest = async (req, res) => {
    try {
        const { id } = req.params;
        const guestData = req.body;

        if (!guestData.name) {
            return error(res, "Tên khách mời không được để trống", 400);
        }

        if (!guestData.id) {
            guestData.id = `guest_${Date.now()}`;
        }

        let invitation = await ThiepCuoi.findOne({ invitationId: id });
        if (!invitation) {
            return error(res, "Thiệp cưới không tồn tại", 404);
        }

        const existingIdx = invitation.guestList.findIndex(g => g.id === guestData.id);
        if (existingIdx >= 0) {
            invitation.guestList[existingIdx] = { ...invitation.guestList[existingIdx].toObject(), ...guestData };
        } else {
            invitation.guestList.unshift(guestData);
        }

        await invitation.save();
        return success(res, "Đã lưu khách mời thành công", invitation.guestList);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 6. Xóa khách mời khỏi thiệp
exports.deleteGuest = async (req, res) => {
    try {
        const { id, guestId } = req.params;
        let invitation = await ThiepCuoi.findOne({ invitationId: id });
        if (!invitation) {
            return error(res, "Thiệp cưới không tồn tại", 404);
        }

        invitation.guestList = invitation.guestList.filter(g => g.id !== guestId);
        await invitation.save();
        return success(res, "Đã xóa khách mời", invitation.guestList);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 7. Gửi phản hồi tham dự (RSVP)
exports.submitRsvp = async (req, res) => {
    try {
        const { id } = req.params;
        const rsvpData = req.body;

        if (!rsvpData.guestName) {
            return error(res, "Vui lòng nhập họ tên của bạn", 400);
        }

        let invitation = await ThiepCuoi.findOne({ invitationId: id });
        if (!invitation) {
            return error(res, "Thiệp cưới không tồn tại", 404);
        }

        invitation.rsvps.unshift(rsvpData);
        await invitation.save();
        return success(res, "Gửi phản hồi tham dự thành công!", invitation.rsvps);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 8. Lấy danh sách phản hồi RSVP
exports.getRsvps = async (req, res) => {
    try {
        const { id } = req.params;
        const invitation = await ThiepCuoi.findOne({ invitationId: id }, { rsvps: 1 });
        if (!invitation) return error(res, "Thiệp không tồn tại", 404);
        return success(res, "Danh sách RSVP", invitation.rsvps);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 9. Gửi lời chúc mừng (Guestbook)
exports.submitWish = async (req, res) => {
    try {
        const { id } = req.params;
        const wishData = req.body;

        if (!wishData.senderName || !wishData.message) {
            return error(res, "Vui lòng nhập tên và lời chúc", 400);
        }

        let invitation = await ThiepCuoi.findOne({ invitationId: id });
        if (!invitation) {
            return error(res, "Thiệp cưới không tồn tại", 404);
        }

        invitation.wishes.unshift(wishData);
        await invitation.save();
        return success(res, "Gửi lời chúc thành công!", invitation.wishes);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 10. Lấy danh sách lời chúc
exports.getWishes = async (req, res) => {
    try {
        const { id } = req.params;
        const invitation = await ThiepCuoi.findOne({ invitationId: id }, { wishes: 1 });
        if (!invitation) return error(res, "Thiệp không tồn tại", 404);
        return success(res, "Danh sách lời chúc", invitation.wishes);
    } catch (err) {
        return error(res, err.message, 500);
    }
};



const KNOWN_TEMPLATES = [
  { id: 'tpl-song-hy-xanh', code: 'VIP-SONGHY-06', themeId: 'song-hy-xanh', baseLayout: 'song-hy-xanh', name: 'Song Hỷ Xanh (Song Hỷ Xanh Lá & Ngọc Lục Bảo)', musicUrl: '/audio/MOIDUYENVANG.mp3', musicTitle: 'Mối Duyên Vàng' },
  { id: 'tpl-minimalism-xanh', code: 'VIP-MINIGREEN-07', themeId: 'minimalism-xanh', baseLayout: 'minimalism-xanh', name: 'Minimalism Xanh (Tối Giản Xanh Lá Thảo Mộc)', musicUrl: 'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3', musicTitle: 'Acoustic Love - Giai Điệu Dịu Êm' },
  { id: 'tpl-dreamy-fairytale', code: 'VIP-DREAMY-05', themeId: 'dreamy-fairytale', baseLayout: 'dreamy-fairytale', name: 'Lâu Đài Cổ Tích & Nơ Lụa Hồng (Dreamy Fairytale)' },
  { id: 'tpl-luxury-gold', code: 'VIP-GOLD-01', themeId: 'luxury-gold', baseLayout: 'standard', name: 'Hoàng Gia & Ánh Kim (Luxury Gold)' },
  { id: 'tpl-romantic-rose', code: 'VIP-ROSE-02', themeId: 'romantic-rose', baseLayout: 'standard', name: 'Nàng Thơ & Hoa Hồng (Romantic Rose)' },
  { id: 'tpl-modern-minimal', code: 'FREE-MINIMAL-01', themeId: 'modern-minimal', baseLayout: 'standard', name: 'Tối Giản & Thanh Lịch (Modern Minimalist)' },
  { id: 'tpl-botanical-garden', code: 'FREE-BOTANIC-02', themeId: 'botanical-garden', baseLayout: 'standard', name: 'Cỏ Hoa & Thảo Mộc (Botanical Garden)' },
  { id: 'tpl-royal-red', code: 'VIP-RED-03', themeId: 'royal-red', baseLayout: 'standard', name: 'Son Hỷ & Á Đông (Royal Crimson)' },
  { id: 'tpl-korean-pastel', code: 'VIP-PASTEL-04', themeId: 'korean-pastel', baseLayout: 'standard', name: 'Hàn Quốc Dịu Êm (Korean Pastel)' }
];

// Đọc động toàn bộ danh sách mẫu thiệp từ Database (Website Section + Bảng Dịch Vụ loaiDichVu=5 + KNOWN_TEMPLATES)
async function getDynamicTemplates() {
    const mergedMap = new Map();
    for (const tpl of KNOWN_TEMPLATES) {
        mergedMap.set(tpl.id, { ...tpl });
    }

    try {
        const WEBSITE = require("../models/website.model");
        const sec = await WEBSITE.findOne({ section: 'invitation-templates' }).lean();
        if (sec && Array.isArray(sec.data)) {
            for (const item of sec.data) {
                if (!item || (!item.id && !item.themeId)) continue;
                const key = item.id || `tpl-${item.themeId}`;
                const existing = mergedMap.get(key) || {};
                mergedMap.set(key, {
                    ...existing,
                    ...item,
                    id: key,
                    code: item.code || item.serviceCode || existing.code || key.toUpperCase(),
                    themeId: item.themeId || existing.themeId || key.replace(/^tpl-/, ''),
                    baseLayout: item.baseLayout || existing.baseLayout || item.themeId || 'standard',
                    name: item.name || existing.name || key
                });
            }
        }
    } catch (e) {}

    try {
        const DichVu = require("../models/dichVu.model");
        const dvList = await DichVu.find({ loaiDichVu: 5 }).lean();
        if (Array.isArray(dvList)) {
            for (const dv of dvList) {
                const tplId = dv.templateId || (dv.maDichVu ? `tpl-${dv.maDichVu.toLowerCase()}` : '');
                if (!tplId) continue;
                const existing = mergedMap.get(tplId);
                if (existing) {
                    if (!existing.code && dv.maDichVu) existing.code = dv.maDichVu;
                } else {
                    mergedMap.set(tplId, {
                        id: tplId,
                        code: dv.maDichVu,
                        serviceCode: dv.maDichVu,
                        themeId: tplId.replace(/^tpl-/, ''),
                        baseLayout: 'standard',
                        name: dv.tenDichVu || tplId,
                        thumbnail: dv.imageDichVu || '',
                        accessType: dv.accessType || 'vip',
                        badge: dv.badge || 'ĐẶC QUYỀN VIP',
                        category: dv.category || 'Hiện Đại'
                    });
                }
            }
        }
    } catch (e) {}

    return Array.from(mergedMap.values());
}

function resolveTemplateFromCartItem(item, templatesList = KNOWN_TEMPLATES) {
    if (!item) return null;
    const activeTemplates = Array.isArray(templatesList) && templatesList.length > 0 ? templatesList : KNOWN_TEMPLATES;
    const tenDV = (item.tenDichVuSnapshot || item.dichVu?.tenDichVu || '').toLowerCase();
    const maDV = (item.maDichVu || item.dichVu?.maDichVu || '').toLowerCase();
    const moTa = (item.moTaDichVu || item.dichVu?.moTaDichVu || '').toLowerCase();
    const maLoaiThiep = (item.maLoaiThiep || item.dichVu?.templateId || '').toLowerCase();
    const isThiep = Number(item.loaiDichVu) === 5 || item.loaiDichVu === '5' ||
                    Number(item.dichVu?.loaiDichVu) === 5 ||
                    tenDV.includes('thiệp') || tenDV.includes('thiep') ||
                    maDV.includes('thiep') || maDV.includes('songhy') || maDV.includes('minigreen') ||
                    maLoaiThiep !== '' ||
                    moTa.includes('thiệp') || moTa.includes('thiep');
    if (!isThiep) return null;

    for (const tpl of activeTemplates) {
        const id = (tpl.id || '').toLowerCase();
        const code = (tpl.code || tpl.serviceCode || '').toLowerCase();
        const theme = (tpl.themeId || '').toLowerCase();
        if (maLoaiThiep && (maLoaiThiep === id || maLoaiThiep === code || maLoaiThiep === theme)) return tpl;
        if (maDV && (maDV === code || maDV === id || maDV === theme)) return tpl;
    }

    const full = `${maLoaiThiep} ${maDV} ${tenDV} ${moTa}`;
    for (const tpl of activeTemplates) {
        const id = (tpl.id || '').toLowerCase();
        const code = (tpl.code || tpl.serviceCode || '').toLowerCase();
        const theme = (tpl.themeId || '').toLowerCase();
        if ((id && full.includes(id)) || (code && full.includes(code)) || (theme && full.includes(theme))) return tpl;
    }

    for (const tpl of activeTemplates) {
        const mainName = (tpl.name || '').split('(')[0].trim().toLowerCase();
        if (mainName && tenDV.includes(mainName)) return tpl;
    }

    return activeTemplates[0];
}

// Tự động bóc tách ảnh cưới đã chỉnh sửa từ Album của Hợp Đồng để nạp sẵn vào Thiệp Cưới
async function extractAlbumPhotosForContract(maHopDong) {
    if (!maHopDong) return { mainPhoto: '', groomAvatar: '', brideAvatar: '', gallery: [] };
    try {
        const AlbumModel = require("../models/album.model");
        const album = await AlbumModel.findOne({ maHopDong }).lean();
        if (!album) return { mainPhoto: '', groomAvatar: '', brideAvatar: '', gallery: [] };

        const rawList = (Array.isArray(album.danhSachAnhChinhSua) && album.danhSachAnhChinhSua.length > 0)
            ? album.danhSachAnhChinhSua
            : (Array.isArray(album.danhSachAnh) ? album.danhSachAnh : []);

        if (rawList.length === 0) return { mainPhoto: '', groomAvatar: '', brideAvatar: '', gallery: [] };

        // Ưu tiên ảnh đánh dấu isCover hoặc isHearted lên đầu
        const sorted = [...rawList].sort((a, b) => {
            const scoreA = (a.isCover ? 4 : 0) + (a.isHearted ? 2 : 0);
            const scoreB = (b.isCover ? 4 : 0) + (b.isHearted ? 2 : 0);
            return scoreB - scoreA;
        });

        const urls = sorted.map(img => img.urlNen || img.urlGoc).filter(Boolean);
        return {
            mainPhoto: urls[0] || '',
            groomAvatar: urls[1] || urls[0] || '',
            brideAvatar: urls[2] || urls[0] || '',
            gallery: urls.slice(0, 12)
        };
    } catch (e) {
        return { mainPhoto: '', groomAvatar: '', brideAvatar: '', gallery: [] };
    }
}

async function autoProvisionCustomerInvitations(customerId) {
    if (!customerId) return;
    try {
        const HopDongModel = require("../models/hopDong.model");
        const KhachHangModel = require("../models/khachHang.model");
        const mongoose = require("mongoose");
        const objId = mongoose.Types.ObjectId.isValid(customerId) ? new mongoose.Types.ObjectId(customerId) : null;
        const queryOr = [{ khachHang1: customerId }, { khachHang2: customerId }];
        if (objId) queryOr.push({ khachHang1: objId }, { khachHang2: objId });

        const contracts = await HopDongModel.find({ $or: queryOr })
            .populate("gioHang.dichVu")
            .populate("khachHang1")
            .populate("khachHang2")
            .lean();

        if (!contracts || contracts.length === 0) return;

        const khachHang = await KhachHangModel.findById(customerId).lean();
        const dynamicTemplates = await getDynamicTemplates();

        for (const contract of contracts) {
            if (!contract.gioHang || !Array.isArray(contract.gioHang)) continue;

            for (const item of contract.gioHang) {
                const tpl = resolveTemplateFromCartItem(item, dynamicTemplates);
                if (!tpl) continue;

                const existing = await ThiepCuoi.findOne({
                    khachHangId: customerId,
                    $or: [
                        { templateId: tpl.id },
                        { themeId: tpl.themeId },
                        { maHopDong: contract.maHopDong }
                    ]
                });

                if (!existing) {
                    const groomName = contract.khachHang1?.tenKhachHang || (khachHang?.gioiTinh === 'Nam' ? khachHang.tenKhachHang : 'Chú Rể');
                    const groomPhone = contract.khachHang1?.soDienThoai || (khachHang?.gioiTinh === 'Nam' ? khachHang.soDienThoai : '');
                    const brideName = contract.khachHang2?.tenKhachHang || (khachHang?.gioiTinh === 'Nữ' ? khachHang.tenKhachHang : 'Cô Dâu');
                    const bridePhone = contract.khachHang2?.soDienThoai || (khachHang?.gioiTinh === 'Nữ' ? khachHang.soDienThoai : '');

                    const ngayCuoiStr = contract.cacNgay?.ngayCuoi 
                        ? new Date(contract.cacNgay.ngayCuoi).toISOString().split('T')[0] 
                        : '';
                    const ngayAnHoiStr = contract.cacNgay?.ngayAnHoi 
                        ? new Date(contract.cacNgay.ngayAnHoi).toISOString().split('T')[0] 
                        : '';

                    // Tự động lấy ảnh cưới từ Album Hợp Đồng (nếu có)
                    const albumPhotos = await extractAlbumPhotosForContract(contract.maHopDong);

                    const newInvitation = new ThiepCuoi({
                        invitationId: `thiep-${(contract.maHopDong || 'hd').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${tpl.themeId || tpl.id}`,
                        khachHangId: customerId,
                        customerId: String(customerId),
                        maHopDong: contract.maHopDong || '',
                        templateId: tpl.id,
                        themeId: tpl.themeId,
                        baseLayout: tpl.baseLayout || tpl.themeId || '',
                        title: `Thiệp Cưới ${(tpl.name || '').split('(')[0].trim()}: ${groomName} & ${brideName}`,
                        mainPhoto: albumPhotos.mainPhoto || '',
                        gallery: albumPhotos.gallery || [],
                        groom: {
                            name: groomName,
                            phone: groomPhone,
                            avatar: contract.khachHang1?.avatar || khachHang?.avatar || albumPhotos.groomAvatar || '',
                            bank: 'MB Bank',
                            order: 'Trưởng Nam'
                        },
                        bride: {
                            name: brideName,
                            phone: bridePhone,
                            avatar: contract.khachHang2?.avatar || albumPhotos.brideAvatar || '',
                            bank: 'Vietcombank',
                            order: 'Ái Nữ'
                        },
                        vuQuy: {
                            enabled: true,
                            title: 'LỄ VU QUY',
                            time: '08:30',
                            dateSolar: ngayAnHoiStr,
                            locationName: 'Tư Gia Nhà Gái',
                            address: contract.cacNgay?.diaDiemChup || ''
                        },
                        thanhHon: {
                            enabled: true,
                            title: 'LỄ THÀNH HÔN',
                            time: '11:00',
                            dateSolar: ngayCuoiStr,
                            locationName: 'Tư Gia Nhà Trai',
                            address: contract.cacNgay?.diaDiemChup || ''
                        },
                        tiecCuoi: {
                            enabled: true,
                            title: 'TIỆC MỪNG TRỌNG ĐẠI',
                            time: '18:00',
                            dateSolar: ngayCuoiStr,
                            locationName: contract.cacNgay?.diaDiemChup || 'Gala Center',
                            address: 'Long Wedding Studio'
                        },
                        musicUrl: tpl.musicUrl || '/audio/MOIDUYENVANG.mp3',
                        musicTitle: tpl.musicTitle || 'Mối Duyên Vàng',
                        isPublished: false
                    });

                    await newInvitation.save();
                }
            }
        }
    } catch (e) {
        console.error("Lỗi autoProvisionCustomerInvitations:", e);
    }
}

// 2a. Lấy danh sách tất cả thiệp cưới thật của khách hàng (Đang phát hành & Đang làm dở)
exports.getMyInvitations = async (req, res) => {
    try {
        const customerId = req.user?.id || req.params.customerId;
        if (!customerId) {
            return error(res, "Vui lòng đăng nhập tài khoản khách hàng", 401);
        }

        // Tự động kiểm tra hợp đồng và tạo sẵn mẫu thiệp nếu khách có đăng ký
        await autoProvisionCustomerInvitations(customerId);

        const invitations = await ThiepCuoi.find({ khachHangId: customerId }).sort({ updatedAt: -1 });

        return success(res, "Lấy danh sách thiệp cưới thành công", invitations || []);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 3b. Đổi trạng thái phát hành (Làm dở <-> Đang phát hành)
exports.togglePublishStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isPublished } = req.body;
        let invitation = await ThiepCuoi.findOne({
            $or: [{ invitationId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }]
        });
        if (!invitation) return error(res, "Không tìm thấy thiệp cưới", 404);

        invitation.isPublished = typeof isPublished === 'boolean' ? isPublished : !invitation.isPublished;
        await invitation.save();

        return success(res, `Đã chuyển thiệp sang: ${invitation.isPublished ? 'Đang phát hành' : 'Bản nháp (Đang làm dở)'}`, invitation);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 3c. Xóa một mẫu thiệp
exports.deleteInvitation = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return error(res, "Thiếu mã thiệp cần xóa", 400);

        const query = (id && id.match(/^[0-9a-fA-F]{24}$/)) 
            ? { $or: [{ invitationId: id }, { _id: id }] }
            : { invitationId: id };

        const deleted = await ThiepCuoi.findOneAndDelete(query);
        if (!deleted) {
            // Thử tìm theo dạng regex nếu có tiền tố
            const fallback = await ThiepCuoi.findOneAndDelete({ invitationId: new RegExp(id, 'i') });
            if (!fallback) {
                return error(res, "Không tìm thấy thiệp để xóa", 404);
            }
            return success(res, "Đã xóa thiệp cưới thành công", fallback);
        }

        return success(res, "Đã xóa thiệp cưới thành công", deleted);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// 8. Lấy UID, Họ Tên và Avatar THỰC từ link Facebook (Công khai cho tạo thiệp online)
exports.getFacebookAvatar = async (req, res) => {
    let { url } = req.body || {};
    if (!url) return error(res, "Vui lòng nhập liên kết hoặc ID Facebook", 400);
    url = String(url).trim();

    try {
        let cleanUrl = url;
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            if (/^\d{5,}$/.test(cleanUrl)) {
                cleanUrl = `https://www.facebook.com/profile.php?id=${cleanUrl}`;
            } else {
                cleanUrl = `https://www.facebook.com/${cleanUrl}`;
            }
        }

        let realAvatar = '';
        let realName = '';
        let uid = '';

        // 1. Quét Open Graph qua Twitterbot Crawler (Facebook trả về đúng ảnh đại diện thực và tên đầy đủ)
        try {
            const ogRes = await fetch(cleanUrl, {
                headers: {
                    'User-Agent': 'Twitterbot/1.0',
                    'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                }
            });
            const html = await ogRes.text();

            const ogImageMatch = html.match(/property="og:image"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:image"/i);
            const ogTitleMatch = html.match(/property="og:title"\s+content="([^"]+)"/i) || html.match(/content="([^"]+)"\s+property="og:title"/i);

            if (ogImageMatch && ogImageMatch[1]) {
                const img = ogImageMatch[1].replace(/&amp;/g, '&');
                // Loại trừ ảnh bóng mặc định của Facebook nếu có
                if (!img.includes('84628273_176159830277856') && !img.includes('lookaside.fbsbx.com/lookaside/crawler/media')) {
                    realAvatar = img;
                }
            }

            if (ogTitleMatch && ogTitleMatch[1]) {
                const rawTitle = decodeHtmlEntities(ogTitleMatch[1]).trim();
                realName = rawTitle.replace(/\s*\|\s*Facebook$/i, '').trim();
            }

            const uidMatch = html.match(/"userID":"(\d+)"/) || html.match(/fb:\/\/profile\/(\d+)/) || html.match(/"entity_id":"(\d+)"/);
            if (uidMatch && uidMatch[1]) {
                uid = uidMatch[1];
            }
        } catch (ogErr) {
            console.warn('Lỗi quét OG Facebook:', ogErr.message);
        }

        // 2. Nếu chưa có UID, kiểm tra URL hoặc tra cứu qua Traodoisub / Lookup-id
        if (!uid) {
            const numMatch = cleanUrl.match(/[?&]id=(\d+)/i) || cleanUrl.match(/profile\.php\?id=(\d+)/i);
            if (numMatch) {
                uid = numMatch[1];
            } else if (/^\d{5,}$/.test(url)) {
                uid = url;
            }
        }

        if (!uid) {
            try {
                const formData = new URLSearchParams();
                formData.append('link', cleanUrl);
                const tdsRes = await fetch('https://id.traodoisub.com/api.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    },
                    body: formData.toString()
                });
                const text = await tdsRes.text();
                if (text && text.trim().startsWith('{')) {
                    const json = JSON.parse(text);
                    if (json.success === 200 && json.id) {
                        uid = String(json.id);
                        if (!realName && json.name) realName = json.name;
                    }
                }
            } catch (e1) {}
        }

        if (!uid) {
            try {
                const lookupRes = await fetch('https://lookup-id.com/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    },
                    body: new URLSearchParams({ fburl: cleanUrl, check: 'Lookup' }).toString()
                });
                const html = await lookupRes.text();
                const m = html.match(/id="code"[^>]*>(\d+)</i) || html.match(/class="code"[^>]*>(\d+)</i) || html.match(/result[^\d]*(\d{10,})/i);
                if (m && m[1]) {
                    uid = m[1];
                }
            } catch (e2) {}
        }

        // 3. Nếu chưa có realAvatar thì fallback sang Graph API hoặc Facebook CDN
        if (!realAvatar && uid) {
            realAvatar = `https://graph.facebook.com/${uid}/picture?width=500&height=500`;
            try {
                const graphRes = await fetch(`https://graph.facebook.com/${uid}/picture?width=500&height=500&redirect=false`);
                const graphJson = await graphRes.json();
                if (graphJson && graphJson.data && graphJson.data.url && !graphJson.data.is_silhouette) {
                    realAvatar = graphJson.data.url;
                }
            } catch (e) {}
        }

        if (!realAvatar && !uid) {
            return error(res, "Không thể tìm thấy thông tin từ link Facebook này. Vui lòng kiểm tra lại!", 404);
        }

        return success(res, "Lấy ảnh Facebook thành công!", {
            uid: uid || '',
            name: realName || '',
            avatar: realAvatar,
            fbUrl: cleanUrl
        });
    } catch (err) {
        return error(res, err.message || "Lỗi khi lấy thông tin Facebook", 500);
    }
};


// 12. Phục vụ Open Graph Preview động cho Zalo, Facebook Messenger, iMessage, SMS
exports.getInvitationShareSeo = async (req, res) => {
    try {
        const { id, guestSlug } = req.params;
        let invitation = await findInvitationByAnyId(id);

        let rawGuest = (req.query.to || req.query.guest || req.query.khach || '').trim();
        if (!rawGuest && guestSlug) {
            rawGuest = decodeURIComponent(guestSlug).replace(/[-_]+/g, ' ').trim();
        }
        let guestName = 'Quý Khách';
        if (rawGuest) {
            // Chuẩn hóa tên khách mời, loại bỏ tiền tố thừa như "Kính mời:", "Kính gửi", "Gửi"
            const clean = rawGuest.replace(/^(kính\s*mời:?|kính\s*gửi:?|gửi:?)\s*/i, '').trim();
            if (clean) guestName = clean;
        }

        // Xác định loại lễ: lễ thành hôn (Nhà Trai) hay lễ vu quy (Nhà Gái)
        let partText = 'thành hôn';
        const typeParam = (req.query.type || '').toLowerCase();
        const greetingParam = (req.query.greeting || '').toLowerCase();

        if (typeParam.includes('vuquy') || typeParam.includes('vu quy') || greetingParam.includes('vu quy')) {
            partText = 'vu quy';
        } else if (typeParam.includes('thanhhon') || typeParam.includes('thành hôn') || greetingParam.includes('thành hôn')) {
            partText = 'thành hôn';
        } else {
            // Kiểm tra trong danh sách khách mời nếu có lưu thông tin nhóm
            if (rawGuest && invitation && invitation.guestList && invitation.guestList.length > 0) {
                const matchedGuest = invitation.guestList.find(g => 
                    g.name && g.name.trim().toLowerCase() === rawGuest.toLowerCase()
                );
                if (matchedGuest) {
                    const grp = (matchedGuest.group || '').toLowerCase();
                    if (grp.includes('cô dâu') || grp.includes('nhà gái')) {
                        partText = 'vu quy';
                    } else if (grp.includes('chú rể') || grp.includes('nhà trai')) {
                        partText = 'thành hôn';
                    }
                }
            }
            // Nếu vẫn chưa xác định, kiểm tra trạng thái bật của vuQuy/thanhHon trong thiệp
            if (partText === 'thành hôn' && invitation) {
                if (invitation.vuQuy?.enabled && !invitation.thanhHon?.enabled) {
                    partText = 'vu quy';
                }
            }
        }

        // Tên Cô Dâu Chú Rể
        const groomName = invitation?.groom?.name?.trim() || 'Chú Rể';
        const brideName = invitation?.bride?.name?.trim() || 'Cô Dâu';
        const coupleNames = `${groomName} & ${brideName}`;

        // Tiêu đề chuẩn theo đúng định dạng: Kính mời: Tên khách mời tham dự lễ thành hôn/ vu quy của Tên Dâu Rể
        const title = `Kính mời: ${guestName} tham dự lễ ${partText} của ${coupleNames}`;

        // Nội dung phụ (OG Description): Lời gửi, ngày giờ và địa điểm tổ chức
        const eventData = partText === 'vu quy'
            ? (invitation?.vuQuy?.enabled ? invitation?.vuQuy : invitation?.tiecCuoi)
            : (invitation?.thanhHon?.enabled ? invitation?.thanhHon : invitation?.tiecCuoi);

        const timeStr = eventData?.time ? `vào lúc ${eventData.time}` : '';
        const dateStr = eventData?.dateSolar ? `ngày ${eventData.dateSolar}` : '';
        const locationName = eventData?.locationName || '';
        const address = eventData?.address || '';
        const venueStr = locationName ? `tại ${locationName}${address ? ` (${address})` : ''}` : (address ? `tại ${address}` : '');

        let customGreeting = req.query.greeting ? req.query.greeting.trim() : '';
        if (!customGreeting && rawGuest && invitation?.guestList) {
            const matched = invitation.guestList.find(g => g.name && g.name.trim().toLowerCase() === rawGuest.toLowerCase());
            if (matched?.customGreeting) customGreeting = matched.customGreeting.trim();
        }

        let description = '';
        if (customGreeting) {
            description = `${customGreeting}. Trân trọng kính mời ${guestName} đến chung vui cùng gia đình chúng tôi ${timeStr} ${dateStr} ${venueStr}. Nhấn để mở thiệp cưới online!`.replace(/\s+/g, ' ').trim();
        } else {
            description = `Trân trọng kính mời ${guestName} đến tham dự lễ ${partText} và chung vui cùng ${coupleNames} ${timeStr} ${dateStr} ${venueStr}. Sự hiện diện của bạn là niềm vinh hạnh to lớn cho chúng tôi!`.replace(/\s+/g, ' ').trim();
        }

        // Hình ảnh bìa cưới dâu rể (OG Image / Thumbnail: Ưu tiên ảnh dâu rể trong thiệp, KHÔNG dùng logo)
        let imageUrl = (invitation?.mainPhoto && typeof invitation.mainPhoto === 'string' && !invitation.mainPhoto.includes('placeholder')) ? invitation.mainPhoto.trim() : '';
        if (!imageUrl && Array.isArray(invitation?.gallery) && invitation.gallery.length > 0) {
            const validGallery = invitation.gallery.find(img => img && typeof img === 'string' && !img.includes('placeholder'));
            if (validGallery) imageUrl = validGallery.trim();
        }
        if (!imageUrl && invitation?.groom?.avatar && typeof invitation.groom.avatar === 'string' && !invitation.groom.avatar.includes('placeholder') && !invitation.groom.avatar.includes('avatar-placeholder')) {
            imageUrl = invitation.groom.avatar.trim();
        }
        if (!imageUrl && invitation?.bride?.avatar && typeof invitation.bride.avatar === 'string' && !invitation.bride.avatar.includes('placeholder') && !invitation.bride.avatar.includes('avatar-placeholder')) {
            imageUrl = invitation.bride.avatar.trim();
        }

        // Nếu chưa upload ảnh dâu rể riêng, dùng ảnh cưới dâu rể mẫu theo Template thiệp (TUYỆT ĐỐI KHÔNG DÙNG LOGO)
        if (!imageUrl) {
            const tplId = (invitation?.templateId || invitation?.themeId || id || '').toLowerCase();
            if (tplId.includes('minimalism') || tplId.includes('minigreen')) {
                imageUrl = '/images/minimalism-green/thumbnail.webp';
            } else if (tplId.includes('song-hy') || tplId.includes('songhy')) {
                imageUrl = '/images/song-hy/hero-arch.jpg';
            } else if (tplId.includes('dreamy')) {
                imageUrl = '/images/dreamy/palace.jpg';
            } else {
                imageUrl = '/images/song-hy/hero-arch.jpg';
            }
        }

        // Chuẩn hóa đường dẫn ảnh tuyệt đối (Full URL) để Zalo / Facebook / Messenger hiển thị chuẩn xác
        const isLocalHost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
        const clientBase = process.env.CLIENT_URL || process.env.REACT_APP_CLIENT_WEBSITE_URL || (isLocalHost ? 'http://localhost:3000' : 'https://longwedding.vn');
        const apiHostBase = (req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http') + '://' + req.get('host');

        if (imageUrl.startsWith('/uploads') || imageUrl.startsWith('uploads')) {
            imageUrl = `${apiHostBase}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        } else if (imageUrl.startsWith('/')) {
            imageUrl = `${clientBase}${imageUrl}`;
        } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
            imageUrl = `${clientBase}/${imageUrl}`;
        }

        // Đường dẫn đích trên React Frontend
        const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
        const frontendBase = process.env.CLIENT_URL || process.env.REACT_APP_CLIENT_WEBSITE_URL || (isLocal ? 'http://localhost:3000' : 'https://longwedding.vn');
        
        const targetPath = `/thiep-moi/${invitation?.invitationId || id}`;
        const queryParams = new URLSearchParams();
        if (rawGuest) queryParams.set('guest', rawGuest);
        if (req.query.greeting) queryParams.set('greeting', req.query.greeting);
        if (req.query.avatar) queryParams.set('avatar', req.query.avatar);
        const queryString = queryParams.toString();
        const targetUrl = `${frontendBase}${targetPath}${queryString ? `?${queryString}` : ''}`;

        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const currentFullUrl = `${protocol}://${host}${req.originalUrl}`;

        const userAgent = (req.headers['user-agent'] || '').toLowerCase();
        const isBot = /facebookexternalhit|facebot|zalo|twitterbot|telegrambot|whatsapp|skypeuripreview|linkedinbot|applebot|googlebot|bingbot/i.test(userAgent);
        
        const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">

  <!-- Open Graph / Facebook / Zalo -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${currentFullUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${title}">
  <meta property="og:site_name" content="Long Wedding Studio">

  <!-- Zalo Preview Meta -->
  <meta property="zalo:title" content="${title}">
  <meta property="zalo:description" content="${description}">
  <meta property="zalo:image" content="${imageUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <link rel="image_src" href="${imageUrl}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${currentFullUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">

  <!-- Canonical -->
  <link rel="canonical" href="${currentFullUrl}">

  ${!isBot ? `
  <!-- Chuyển hướng người dùng thực tế vào ứng dụng React SPA -->
  <script>
    window.location.replace("${targetUrl}");
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=${targetUrl}">
  </noscript>
  ` : ''}
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #faf8f5;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    .loading-card {
      background: #fff;
      padding: 32px 24px;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      max-width: 440px;
      width: 100%;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3px solid rgba(212, 163, 115, 0.2);
      border-top-color: #d4a373;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 { font-size: 18px; margin: 0 0 8px; color: #2c2c2c; line-height: 1.4; }
    p { font-size: 14px; color: #777; margin: 0 0 20px; }
    a { display: inline-block; padding: 10px 22px; background: #d4a373; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="loading-card">
    <div class="spinner"></div>
    <h2>${title}</h2>
    <p>Đang mở thiệp cưới...</p>
    <a href="${targetUrl}">Bấm vào đây nếu không tự động chuyển tiếp</a>
  </div>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    } catch (err) {
        console.error("Lỗi getInvitationShareSeo:", err);
        return res.status(500).send("Lỗi máy chủ khi tạo trang xem trước");
    }
};


// Hàm helper kiểm tra xem đơn hàng của khách hàng có dịch vụ Thiệp Mời Online và đúng mã loại thiệp không
const validateCustomerInvitationEligibility = async (customerId, requestedTemplateId = null) => {
    try {
        if (!customerId) {
            return {
                allowed: false,
                hasService: false,
                allowedTemplateIds: [],
                contractInfo: null,
                reason: 'Vui lòng đăng nhập tài khoản khách hàng.'
            };
        }

        const HopDongModel = require("../models/hopDong.model");
        const mongoose = require("mongoose");
        const objId = mongoose.Types.ObjectId.isValid(customerId) ? new mongoose.Types.ObjectId(customerId) : null;

        // 0. Kiểm tra xem Admin đã cấp quyền mở khóa thủ công (overridePermission) trên thiệp của khách chưa
        const existingOverrideQuery = objId
            ? { $or: [{ khachHangId: objId }, { customerId: String(customerId) }], overridePermission: true }
            : { customerId: String(customerId), overridePermission: true };
        const overriddenInvitations = await ThiepCuoi.find(existingOverrideQuery).lean();
        if (overriddenInvitations && overriddenInvitations.length > 0) {
            const overrideTplIds = [];
            for (const inv of overriddenInvitations) {
                if (inv.templateId) overrideTplIds.push(inv.templateId.toLowerCase());
                if (inv.themeId) overrideTplIds.push(inv.themeId.toLowerCase());
            }
            if (!requestedTemplateId || overrideTplIds.length === 0 || overrideTplIds.some(t => t === requestedTemplateId.toLowerCase() || requestedTemplateId.toLowerCase().includes(t))) {
                return {
                    allowed: true,
                    hasService: true,
                    overridePermission: true,
                    allowedTemplateIds: overrideTplIds,
                    contractInfo: { maHopDong: overriddenInvitations[0].maHopDong || 'ADMIN-GRANTED' },
                    reason: 'Đã được Quản trị viên cấp đặc quyền mở khóa thiệp cưới online'
                };
            }
        }

        // Tìm tất cả hợp đồng của khách hàng
        const queryOr = [{ khachHang1: customerId }, { khachHang2: customerId }];
        if (objId) {
            queryOr.push({ khachHang1: objId }, { khachHang2: objId });
        }
        const contracts = await HopDongModel.find({ $or: queryOr }).populate("gioHang.dichVu").lean();
        const dynamicTemplates = await getDynamicTemplates();

        // Cho phép các mẫu thiệp miễn phí (accessType === 'free') ngay cả khi hợp đồng chưa ghi riêng mã VIP
        if (requestedTemplateId) {
            const reqLower = requestedTemplateId.trim().toLowerCase();
            const matchedFreeTpl = dynamicTemplates.find(t =>
                t.accessType === 'free' &&
                ((t.id && t.id.toLowerCase() === reqLower) || (t.themeId && t.themeId.toLowerCase() === reqLower) || (t.code && t.code.toLowerCase() === reqLower))
            );
            if (matchedFreeTpl && contracts && contracts.length > 0) {
                return {
                    allowed: true,
                    hasService: true,
                    allowedTemplateIds: [matchedFreeTpl.id, matchedFreeTpl.themeId, (matchedFreeTpl.code || '').toLowerCase()].filter(Boolean),
                    contractInfo: { maHopDong: contracts[0]?.maHopDong },
                    reason: 'Mẫu thiệp miễn phí dành cho khách hàng của Long Wedding Studio'
                };
            }
        }

        if (!contracts || contracts.length === 0) {
            return {
                allowed: false,
                hasService: false,
                allowedTemplateIds: [],
                contractInfo: null,
                reason: 'Bạn chưa có hợp đồng nào tại Long Wedding Studio. Vui lòng liên hệ Studio để được đăng ký gói dịch vụ!'
            };
        }

        let hasInvitationService = false;
        let allowedTemplates = [];
        let matchedContract = null;

        for (const contract of contracts) {
            if (contract.gioHang && Array.isArray(contract.gioHang)) {
                for (const item of contract.gioHang) {
                    const tenDV = (item.tenDichVuSnapshot || item.dichVu?.tenDichVu || '').toLowerCase();
                    const maDV = (item.maDichVu || item.dichVu?.maDichVu || '').toLowerCase();
                    const moTa = (item.moTaDichVu || item.dichVu?.moTaDichVu || '').toLowerCase();
                    const itemMaThiep = (item.maLoaiThiep || item.dichVu?.templateId || '').toLowerCase();

                    // Nhận diện dịch vụ thiệp mời online
                    const isThiep = Number(item.loaiDichVu) === 5 || item.loaiDichVu === '5' ||
                                    Number(item.dichVu?.loaiDichVu) === 5 ||
                                    tenDV.includes('thiệp') || tenDV.includes('thiep') ||
                                    maDV.includes('thiep') || maDV.includes('songhy') || maDV.includes('minigreen') ||
                                    itemMaThiep !== '' ||
                                    moTa.includes('thiệp') || moTa.includes('thiep');

                    if (isThiep) {
                        hasInvitationService = true;
                        matchedContract = contract;

                        const resolvedTpl = resolveTemplateFromCartItem(item, dynamicTemplates);
                        if (resolvedTpl) {
                            if (!allowedTemplates.includes(resolvedTpl.id)) allowedTemplates.push(resolvedTpl.id);
                            if (resolvedTpl.code && !allowedTemplates.includes(resolvedTpl.code.toLowerCase())) allowedTemplates.push(resolvedTpl.code.toLowerCase());
                            if (resolvedTpl.themeId && !allowedTemplates.includes(resolvedTpl.themeId)) allowedTemplates.push(resolvedTpl.themeId);
                        }

                        if (itemMaThiep && !allowedTemplates.includes(itemMaThiep)) {
                            allowedTemplates.push(itemMaThiep);
                        }

                        const tplMatch = (itemMaThiep + ' ' + maDV + ' ' + tenDV + ' ' + moTa).match(/tpl-[a-z0-9-]+/gi);
                        if (tplMatch) {
                            tplMatch.forEach(m => {
                                const cleanM = m.toLowerCase();
                                if (!allowedTemplates.includes(cleanM)) {
                                    allowedTemplates.push(cleanM);
                                }
                            });
                        }
                    }
                }
            }
        }

        if (!hasInvitationService) {
            return {
                allowed: false,
                hasService: false,
                allowedTemplateIds: [],
                contractInfo: null,
                reason: 'Trong đơn hàng của bạn chưa đăng ký Dịch vụ Thiệp Mời Online. Vui lòng liên hệ Studio để đăng ký dịch vụ!'
            };
        }

        // Nếu hợp đồng có dịch vụ thiệp nhưng chưa gán mã loại thiệp cụ thể -> cho phép tất cả các mẫu mặc định
        // Nhưng nếu đã có mã loại thiệp cụ thể -> Bắt buộc phải trùng khớp mã loại thiệp!
        if (requestedTemplateId && allowedTemplates.length > 0) {
            const reqClean = requestedTemplateId.trim().toLowerCase();
            const isMatch = allowedTemplates.some(t => t === reqClean || reqClean.includes(t) || t.includes(reqClean));
            if (!isMatch) {
                return {
                    allowed: false,
                    hasService: true,
                    allowedTemplateIds: allowedTemplates,
                    contractInfo: {
                        maHopDong: matchedContract?.maHopDong
                    },
                    reason: `Mẫu thiệp "${requestedTemplateId}" không khớp với mã loại thiệp đã đăng ký trong đơn hàng của bạn (Mã đăng ký: ${allowedTemplates.join(', ')}).`
                };
            }
        }

        return {
            allowed: true,
            hasService: true,
            allowedTemplateIds: allowedTemplates,
            contractInfo: {
                maHopDong: matchedContract?.maHopDong
            },
            reason: 'Đủ điều kiện tạo và chỉnh sửa thiệp cưới online'
        };
    } catch (err) {
        console.error('Lỗi validateCustomerInvitationEligibility:', err);
        return {
            allowed: false,
            hasService: false,
            allowedTemplateIds: [],
            reason: err.message
        };
    }
};

// API Endpoint kiểm tra quyền tạo thiệp cưới của khách hàng
exports.checkInvitationPermission = async (req, res) => {
    try {
        const customerId = req.user?.id || req.query.customerId || req.params.customerId;
        const templateId = req.query.template || req.query.templateId;
        const result = await validateCustomerInvitationEligibility(customerId, templateId);
        return success(res, "Kiểm tra đặc quyền tạo thiệp thành công", result);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

exports.validateCustomerInvitationEligibility = validateCustomerInvitationEligibility;

// API Upload ảnh thiệp cưới trực tiếp (Hỗ trợ chuỗi Base64 trong payload JSON hoặc tệp Multipart)
exports.uploadInvitationImage = async (req, res) => {
    try {
        const host = (req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : req.protocol) + '://' + req.get('host');
        const uploadDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Trường hợp 1: Nhận chuỗi Base64 truyền trong payload JSON
        const rawBase64 = req.body?.base64 || req.body?.image || req.body?.data;
        if (rawBase64 && typeof rawBase64 === 'string') {
            const relativePath = await saveBase64ImageFile(rawBase64, 'opt');
            const absoluteUrl = `${host}${relativePath}`;
            const filename = path.basename(relativePath);

            return res.status(200).json({
                status: "success",
                success: true,
                message: "Giải mã Base64 và lưu ảnh máy chủ thành công",
                data: {
                    url: absoluteUrl,
                    relativePath: relativePath,
                    filename: filename,
                    originalname: req.body?.filename || req.body?.originalname || filename
                }
            });
        }

        // Trường hợp 2: Nhận tệp Multipart từ form-data
        if (req.file) {
            let finalFilename = req.file.filename;
            const originalFilePath = path.join(uploadDir, req.file.filename);

            try {
                const sharp = require('sharp');
                const ext = path.extname(req.file.originalname).toLowerCase();
                
                if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) || req.file.mimetype.startsWith('image/')) {
                    const optimizedFilename = 'opt-' + Date.now() + '-' + Math.round(Math.random() * 1E6) + '.webp';
                    const optimizedFilePath = path.join(uploadDir, optimizedFilename);

                    await sharp(originalFilePath)
                        .rotate()
                        .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 90, effort: 4 })
                        .toFile(optimizedFilePath);

                    finalFilename = optimizedFilename;
                    try {
                        if (fs.existsSync(originalFilePath) && originalFilePath !== optimizedFilePath) {
                            fs.unlinkSync(originalFilePath);
                        }
                    } catch (e) {}
                }
            } catch (optErr) {
                console.warn("Sharp optimization skipped/failed, keeping original upload:", optErr.message);
            }

            const relativePath = `/uploads/${finalFilename}`;
            const absoluteUrl = `${host}${relativePath}`;

            return res.status(200).json({
                status: "success",
                success: true,
                message: "Tải và lưu ảnh lên máy chủ thành công",
                data: {
                    url: absoluteUrl,
                    relativePath: relativePath,
                    filename: finalFilename,
                    originalname: req.file.originalname
                }
            });
        }

        return res.status(400).json({ 
            status: "error", 
            success: false, 
            message: "Vui lòng cung cấp chuỗi Base64 hoặc tệp ảnh hợp lệ để tải lên!" 
        });
    } catch (error) {
        console.error("Lỗi khi tải ảnh thiệp cưới lên backend:", error);
        return res.status(500).json({ status: "error", success: false, message: error.message });
    }
};

// ============================================================================
// BỘ API QUẢN TRỊ THIỆP CƯỚI DÀNH CHO ADMIN / NHÂN VIÊN STUDIO
// ============================================================================

// 13. [ADMIN] Lấy danh sách tất cả các mẫu thiệp đang có (kết hợp Website Section + Bảng DichVu + KNOWN_TEMPLATES)
exports.adminGetTemplatesCatalog = async (req, res) => {
    try {
        const templates = await getDynamicTemplates();
        return success(res, "Lấy danh mục mẫu thiệp cưới thành công", {
            count: templates.length,
            templates
        });
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 14. [ADMIN] Lấy danh sách tất cả thiệp cưới của mọi khách hàng (hỗ trợ lọc, tìm kiếm & thống kê)
exports.adminListInvitations = async (req, res) => {
    try {
        const {
            search = '',
            templateId = '',
            maHopDong = '',
            isPublished,
            page = 1,
            limit = 50
        } = { ...req.query, ...req.body };

        const filter = {};

        if (templateId && templateId !== 'all') {
            filter.$or = [
                { templateId: templateId },
                { themeId: templateId }
            ];
        }

        if (maHopDong) {
            filter.maHopDong = new RegExp(maHopDong.trim(), 'i');
        }

        if (isPublished !== undefined && isPublished !== '' && isPublished !== 'all') {
            filter.isPublished = String(isPublished) === 'true' || isPublished === true;
        }

        if (search && String(search).trim() !== '') {
            const kw = String(search).trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(kw, 'i');
            const searchOr = [
                { invitationId: regex },
                { title: regex },
                { maHopDong: regex },
                { customSlug: regex },
                { 'groom.name': regex },
                { 'groom.phone': regex },
                { 'bride.name': regex },
                { 'bride.phone': regex }
            ];
            if (filter.$or) {
                filter.$and = [{ $or: filter.$or }, { $or: searchOr }];
                delete filter.$or;
            } else {
                filter.$or = searchOr;
            }
        }

        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
        const skip = (pageNum - 1) * limitNum;

        const [total, list] = await Promise.all([
            ThiepCuoi.countDocuments(filter),
            ThiepCuoi.find(filter)
                .populate('khachHangId', 'tenKhachHang soDienThoai maDangNhap avatar')
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean()
        ]);

        const items = (list || []).map(inv => {
            const rsvps = Array.isArray(inv.rsvps) ? inv.rsvps : [];
            const attendingCount = rsvps
                .filter(r => r.status === 'attending')
                .reduce((sum, r) => sum + (Number(r.guestsCount) || 1), 0);

            return {
                ...inv,
                stats: {
                    guestCount: Array.isArray(inv.guestList) ? inv.guestList.length : 0,
                    rsvpResponses: rsvps.length,
                    attendingGuestsCount: attendingCount,
                    wishCount: Array.isArray(inv.wishes) ? inv.wishes.length : 0,
                    galleryCount: Array.isArray(inv.gallery) ? inv.gallery.length : 0
                }
            };
        });

        // Thống kê tổng quan toàn hệ thống
        const [totalAll, publishedCount, draftCount] = await Promise.all([
            ThiepCuoi.countDocuments({}),
            ThiepCuoi.countDocuments({ isPublished: true }),
            ThiepCuoi.countDocuments({ isPublished: false })
        ]);

        return success(res, "Lấy danh sách quản trị thiệp cưới thành công", {
            total,
            page: pageNum,
            limit: limitNum,
            summary: {
                totalInvitations: totalAll,
                publishedInvitations: publishedCount,
                draftInvitations: draftCount
            },
            invitations: items
        });
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 15. [ADMIN] Khởi tạo nhanh thiệp cưới từ Hợp Đồng (Tự động điền thông tin Dâu Rể, Ngày Cưới & lấy ảnh từ Album Hợp Đồng)
exports.adminCreateInvitationFromContract = async (req, res) => {
    try {
        const {
            maHopDong,
            contractId,
            templateId = 'tpl-minimalism-xanh',
            overridePermission = true,
            syncAlbumPhotos = true
        } = req.body || {};

        if (!maHopDong && !contractId) {
            return error(res, "Vui lòng cung cấp mã hợp đồng (maHopDong) hoặc ID hợp đồng (contractId)", 400);
        }

        const HopDongModel = require("../models/hopDong.model");
        const query = contractId
            ? { _id: contractId }
            : { maHopDong: String(maHopDong).trim() };

        const contract = await HopDongModel.findOne(query)
            .populate("gioHang.dichVu")
            .populate("khachHang1")
            .populate("khachHang2")
            .lean();

        if (!contract) {
            return error(res, "Không tìm thấy hợp đồng tương ứng", 404);
        }

        const dynamicTemplates = await getDynamicTemplates();
        let selectedTpl = dynamicTemplates.find(t =>
            t.id === templateId || t.themeId === templateId || t.code === templateId
        );

        // Nếu không truyền templateId cụ thể, tự dò từ giỏ hàng của hợp đồng
        if (!selectedTpl && Array.isArray(contract.gioHang)) {
            for (const item of contract.gioHang) {
                const resolved = resolveTemplateFromCartItem(item, dynamicTemplates);
                if (resolved) {
                    selectedTpl = resolved;
                    break;
                }
            }
        }
        if (!selectedTpl) {
            selectedTpl = dynamicTemplates.find(t => t.id === 'tpl-minimalism-xanh') || dynamicTemplates[0] || KNOWN_TEMPLATES[0];
        }

        const customerId = contract.khachHang1?._id || contract.khachHang2?._id;
        const groomName = contract.khachHang1?.tenKhachHang || 'Chú Rể';
        const groomPhone = contract.khachHang1?.soDienThoai || '';
        const brideName = contract.khachHang2?.tenKhachHang || 'Cô Dâu';
        const bridePhone = contract.khachHang2?.soDienThoai || '';

        const ngayCuoiStr = contract.cacNgay?.ngayCuoi
            ? new Date(contract.cacNgay.ngayCuoi).toISOString().split('T')[0]
            : '';
        const ngayAnHoiStr = contract.cacNgay?.ngayAnHoi
            ? new Date(contract.cacNgay.ngayAnHoi).toISOString().split('T')[0]
            : '';

        const albumPhotos = syncAlbumPhotos
            ? await extractAlbumPhotosForContract(contract.maHopDong)
            : { mainPhoto: '', groomAvatar: '', brideAvatar: '', gallery: [] };

        const cleanContractSlug = (contract.maHopDong || 'hd').toLowerCase().replace(/[^a-z0-9]/g, '-');
        const invitationId = `thiep-${cleanContractSlug}-${selectedTpl.themeId || selectedTpl.id}`;

        const payload = {
            invitationId,
            khachHangId: customerId || undefined,
            customerId: customerId ? String(customerId) : '',
            maHopDong: contract.maHopDong,
            templateId: selectedTpl.id,
            themeId: selectedTpl.themeId,
            baseLayout: selectedTpl.baseLayout || selectedTpl.themeId || '',
            overridePermission: Boolean(overridePermission),
            customSlug: generateSlugFromNames(groomName, brideName),
            title: `Thiệp Cưới ${(selectedTpl.name || '').split('(')[0].trim()}: ${groomName} & ${brideName}`,
            groom: {
                name: groomName,
                nickname: groomName.split(/\s+/).slice(-2).join(' '),
                phone: groomPhone,
                hometown: contract.khachHang1?.diaChi || '',
                avatar: contract.khachHang1?.avatar || albumPhotos.groomAvatar || '',
                bank: 'MB Bank',
                order: 'Trưởng Nam'
            },
            bride: {
                name: brideName,
                nickname: brideName.split(/\s+/).slice(-2).join(' '),
                phone: bridePhone,
                hometown: contract.khachHang2?.diaChi || '',
                avatar: contract.khachHang2?.avatar || albumPhotos.brideAvatar || '',
                bank: 'Vietcombank',
                order: 'Ái Nữ'
            },
            vuQuy: {
                enabled: true,
                title: 'LỄ VU QUY',
                time: '08:30',
                dateSolar: ngayAnHoiStr || ngayCuoiStr,
                locationName: 'Tư Gia Nhà Gái',
                address: contract.khachHang2?.diaChi || contract.cacNgay?.diaDiemChup || ''
            },
            thanhHon: {
                enabled: true,
                title: 'LỄ THÀNH HÔN',
                time: '11:00',
                dateSolar: ngayCuoiStr,
                locationName: 'Tư Gia Nhà Trai',
                address: contract.khachHang1?.diaChi || contract.cacNgay?.diaDiemChup || ''
            },
            tiecCuoi: {
                enabled: true,
                title: 'TIỆC MỪNG TRỌNG ĐẠI',
                time: '18:00',
                dateSolar: ngayCuoiStr,
                locationName: contract.cacNgay?.diaDiemChup || 'Trung Tâm Tiệc Cưới',
                address: contract.khachHang1?.diaChi || 'Long Wedding Studio'
            },
            musicUrl: selectedTpl.musicUrl || '/audio/MOIDUYENVANG.mp3',
            musicTitle: selectedTpl.musicTitle || 'Mối Duyên Vàng'
        };

        if (albumPhotos.mainPhoto) payload.mainPhoto = albumPhotos.mainPhoto;
        if (albumPhotos.gallery && albumPhotos.gallery.length > 0) payload.gallery = albumPhotos.gallery;

        const saved = await ThiepCuoi.findOneAndUpdate(
            { invitationId },
            { $set: payload, $setOnInsert: { isPublished: false } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return success(res, "Đã khởi tạo và đồng bộ thiệp cưới từ Hợp Đồng thành công!", saved);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

// 16. [ADMIN] Đổi mẫu thiệp (templateId/themeId), cấp quyền mở khóa (overridePermission), hoặc đồng bộ lại ảnh từ Album Hợp Đồng
exports.adminUpdateInvitationSettings = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            templateId,
            themeId,
            baseLayout,
            themeConfig,
            overridePermission,
            isPublished,
            maHopDong,
            adminNote,
            syncAlbumPhotos
        } = req.body || {};

        let invitation = await findInvitationByAnyId(id);
        if (!invitation) {
            return error(res, "Không tìm thấy thiệp cưới cần cập nhật", 404);
        }

        const dynamicTemplates = await getDynamicTemplates();
        if (templateId) {
            const matchedTpl = dynamicTemplates.find(t =>
                t.id === templateId || t.themeId === templateId || t.code === templateId
            );
            invitation.templateId = matchedTpl ? matchedTpl.id : templateId;
            invitation.themeId = matchedTpl ? matchedTpl.themeId : (themeId || templateId.replace(/^tpl-/, ''));
            if (matchedTpl?.baseLayout) {
                invitation.baseLayout = matchedTpl.baseLayout;
            }
            if (matchedTpl?.musicUrl && !invitation.musicUrl) {
                invitation.musicUrl = matchedTpl.musicUrl;
                invitation.musicTitle = matchedTpl.musicTitle || '';
            }
        } else if (themeId) {
            invitation.themeId = themeId;
        }

        if (baseLayout !== undefined) invitation.baseLayout = baseLayout;
        if (themeConfig !== undefined) invitation.themeConfig = themeConfig;
        if (typeof overridePermission === 'boolean') invitation.overridePermission = overridePermission;
        if (typeof isPublished === 'boolean') invitation.isPublished = isPublished;
        if (maHopDong !== undefined) invitation.maHopDong = maHopDong;
        if (adminNote !== undefined) invitation.adminNote = adminNote;

        if (syncAlbumPhotos && (invitation.maHopDong || maHopDong)) {
            const albumPhotos = await extractAlbumPhotosForContract(invitation.maHopDong || maHopDong);
            if (albumPhotos.mainPhoto) invitation.mainPhoto = albumPhotos.mainPhoto;
            if (albumPhotos.gallery && albumPhotos.gallery.length > 0) invitation.gallery = albumPhotos.gallery;
            if (!invitation.groom?.avatar && albumPhotos.groomAvatar) invitation.groom.avatar = albumPhotos.groomAvatar;
            if (!invitation.bride?.avatar && albumPhotos.brideAvatar) invitation.bride.avatar = albumPhotos.brideAvatar;
        }

        await invitation.save();
        return success(res, "Đã cập nhật cấu hình quản trị cho thiệp cưới thành công!", invitation);
    } catch (err) {
        return error(res, err.message, 500);
    }
};

exports.getDynamicTemplates = getDynamicTemplates;
