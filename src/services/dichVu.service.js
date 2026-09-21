const DichVu = require("../models/dichVu.model");
const { success, error } = require("../utils/response");
const { createLog } = require("../utils/logger");
const fs = require("fs");
const path = require("path");

async function create(req, res) {

    console.log("Dữ liệu nhận được: ", req.body)
    const { imageDichVu } = req.body;
    const matches = imageDichVu.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return error(res, "Invalid base64");
    const ext = matches[1].split("/")[1];
    const data = matches[2];

    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = `longwedding_${Date.now()}.${ext}`;
    const filePath = path.join(__dirname, "../uploads", fileName);
    fs.writeFileSync(filePath, Buffer.from(data, "base64"));
    const imageUrl = `/api/images/${fileName}`;


    try {
        const dichVu = new DichVu({
            maDichVu: req.body.maDichVu,
            tenDichVu: req.body.tenDichVu,
            loaiDichVu: req.body.loaiDichVu,
            tonKhoDichVu: req.body.tonKhoDichVu,
            giaTriDichVu: req.body.giaTriDichVu,
            giaChoThueDichVu: req.body.giaChoThueDichVu,
            moTaDichVu: req.body.moTaDichVu,
            imageDichVu: imageUrl,
            soLuongAnhChinhSua: req.body.soLuongAnhChinhSua,
            soLuongAnh16x21: req.body.soLuongAnh16x21,
            soLuongAnh20x30: req.body.soLuongAnh20x30,
            soLuongAnh60x90: req.body.soLuongAnh60x90,
            trangDiemNgayAnHoi: req.body.trangDiemNgayAnHoi,
            trangDiemNgayCuoi: req.body.trangDiemNgayCuoi,
            trangPhucChoDoiBeLe: req.body.trangPhucChoDoiBeLe,
            trangPhucCoDauNgayAnHoi: req.body.trangPhucCoDauNgayAnHoi,
            trangPhucChuReNgayAnHoi: req.body.trangPhucChuReNgayAnHoi,
            trangPhucVayCuoiNgayCuoi: req.body.trangPhucVayCuoiNgayCuoi,
            trangPhucVestChuReNgayCuoi: req.body.trangPhucVestChuReNgayCuoi,
            hoaCamTay: req.body.hoaCamTay
        });
        await dichVu.save();
        console.log("Đã tạo dịch vụ: " + req.body.tenDichVu + " thành công !");
        createLog({
            action: `Thêm dịch vụ / gói (${dichVu.tenDichVu})`,
            user: req.user?.fullname || "Quản lý",
            req,
            details: { maDichVu: dichVu.maDichVu, tenDichVu: dichVu.tenDichVu, gia: dichVu.giaChoThueDichVu }
        });
        return success(res, dichVu);
    } catch (err) {
        return error(res, err.message);
    }
}

async function update(req, res) {
    try {
        const {
            maDichVu,
            tenDichVu,
            tonKhoDichVu,
            giaTriDichVu,
            giaChoThueDichVu,
            moTaDichVu,
            imageDichVu,
            soLuongAnhChinhSua,
            soLuongAnh16x21,
            soLuongAnh20x30,
            soLuongAnh60x90,
            trangDiemNgayAnHoi,
            trangDiemNgayCuoi,
            trangPhucChoDoiBeLe,
            trangPhucCoDauNgayAnHoi,
            trangPhucChuReNgayAnHoi,
            trangPhucVayCuoiNgayCuoi,
            trangPhucVestChuReNgayCuoi,
            hoaCamTay
        } = req.body;

        let imageUrl = imageDichVu;
        if (imageDichVu && imageDichVu.startsWith("data:")) {
            const matches = imageDichVu.match(/^data:(.+);base64,(.+)$/);
            if (!matches) return error(res, "Invalid base64");
            const ext = matches[1].split("/")[1];
            const data = matches[2];

            const uploadDir = path.join(__dirname, "../uploads");
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const fileName = `longwedding_${Date.now()}.${ext}`;
            const filePath = path.join(__dirname, "../uploads", fileName);
            fs.writeFileSync(filePath, Buffer.from(data, "base64"));
            imageUrl = `/api/images/${fileName}`;
        }

        const updateFields = {
            tenDichVu: tenDichVu,
            tonKhoDichVu: tonKhoDichVu,
            giaTriDichVu: giaTriDichVu,
            giaChoThueDichVu: giaChoThueDichVu,
            moTaDichVu: moTaDichVu,
            imageDichVu: imageUrl,
            soLuongAnhChinhSua: Number(soLuongAnhChinhSua) || 0,
            soLuongAnh16x21: Number(soLuongAnh16x21) || 0,
            soLuongAnh20x30: Number(soLuongAnh20x30) || 0,
            soLuongAnh60x90: Number(soLuongAnh60x90) || 0,
            trangDiemNgayAnHoi: trangDiemNgayAnHoi || "",
            trangDiemNgayCuoi: trangDiemNgayCuoi || "",
            trangPhucChoDoiBeLe: trangPhucChoDoiBeLe || "",
            trangPhucCoDauNgayAnHoi: trangPhucCoDauNgayAnHoi || "",
            trangPhucChuReNgayAnHoi: trangPhucChuReNgayAnHoi || "",
            trangPhucVayCuoiNgayCuoi: trangPhucVayCuoiNgayCuoi || "",
            trangPhucVestChuReNgayCuoi: trangPhucVestChuReNgayCuoi || "",
            hoaCamTay: hoaCamTay || ""
        };

        const dichVu = await DichVu.updateOne(
            { maDichVu: maDichVu },
            { $set: updateFields }
        );

        if (dichVu.matchedCount == 0) {
            return error(res, "Không tìm thấy dịch vụ để cập nhật");
        }

        createLog({
            action: `Cập nhật dịch vụ / gói (${tenDichVu || maDichVu})`,
            user: req.user?.fullname || "Quản lý",
            req,
            details: { maDichVu, tenDichVu, updateFields }
        });

        return success(res, { message: "Đã cập nhật dịch vụ: " + tenDichVu });

    } catch (err) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
    try {
        const maDichVu = req.body.maDichVu || req.query.maDichVu || req.params.maDichVu || req.body;
        const dichVu = await DichVu.findOneAndDelete({ maDichVu: maDichVu });

        if (!dichVu) {
            return error(res, "Không tìm thấy dịch vụ để xóa");
        }

        console.log("Đã xóa dịch vụ:", dichVu.tenDichVu);
        createLog({
            action: `Xóa dịch vụ / gói (${dichVu.tenDichVu})`,
            user: req.user?.fullname || "Quản lý",
            req,
            details: { maDichVu: dichVu.maDichVu, tenDichVu: dichVu.tenDichVu }
        });
        return success(res, { message: "Xóa dịch vụ thành công" });
    } catch (err) {
        return error(res, err.message);
    }
}

async function find(req, res) {
    try {
        const dichVu = await DichVu.find();
        return success(res, "Tải danh sách dịch vụ thành công", {
            count: dichVu.length,
            dichVu
        })

    } catch (err) {
        return error(res, err.message);
    }
}



async function syncInvitationTemplates(templates) {
    try {
        if (!Array.isArray(templates) || templates.length === 0) {
            return { count: 0, synced: [] };
        }

        const synced = [];
        for (const item of templates) {
            const cleanCode = (item.code || item.serviceCode || item.id || '').trim();
            if (!cleanCode) continue;

            // Loại bỏ mọi ký tự không phải số để lấy giá trị số chuẩn
            const rawPriceStr = (item.price || '').toString().replace(/[^0-9]/g, '');
            const priceNum = Number(rawPriceStr) || 0;

            const dichVuData = {
                maDichVu: cleanCode,
                tenDichVu: item.name || cleanCode,
                loaiDichVu: 5,
                tonKhoDichVu: 9999,
                giaTriDichVu: priceNum,
                giaChoThueDichVu: priceNum,
                moTaDichVu: item.description || ("Mẫu thiệp cưới trực tuyến: " + item.name),
                imageDichVu: item.thumbnail || item.coverImage || "",
                templateId: item.id || item.themeId || "",
                accessType: item.accessType || "vip",
                badge: item.badge || "",
                category: item.category || ""
            };

            const updated = await DichVu.findOneAndUpdate(
                { maDichVu: cleanCode },
                { $set: dichVuData },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            synced.push(updated);
        }
        console.log("[DichVu] Đã đồng bộ " + synced.length + " mẫu thiệp cưới vào danh sách dịch vụ!");
        return { count: synced.length, synced };
    } catch (err) {
        console.error("Lỗi syncInvitationTemplates:", err.message);
        return { count: 0, error: err.message };
    }
}

async function syncInvitationTemplatesRoute(req, res) {
    try {
        let templates = req.body?.templates;
        if (!Array.isArray(templates) || templates.length === 0) {
            const WEBSITE = require("../models/website.model");
            const sec = await WEBSITE.findOne({ section: 'invitation-templates' });
            if (sec && Array.isArray(sec.data)) {
                templates = sec.data;
            }
        }

        const result = await syncInvitationTemplates(templates);

        createLog({
            action: "Đồng bộ " + (result.count || 0) + " mẫu thiệp cưới vào bảng Dịch Vụ",
            user: req.user?.fullname || "Quản lý",
            req,
            details: { count: result.count }
        });

        return success(res, "Đã đồng bộ thành công " + (result.count || 0) + " mẫu thiệp vào cơ sở dữ liệu dịch vụ!", result);
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    create,
    update,
    remove,
    find,
    syncInvitationTemplates,
    syncInvitationTemplatesRoute
};
