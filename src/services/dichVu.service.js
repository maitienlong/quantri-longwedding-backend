const DichVu = require("../models/dichVu.model");
const { success, error } = require("../utils/response");
const fs = require("fs");
const path = require("path");

async function create(req, res) {
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
            imageDichVu: imageUrl
        });
        await dichVu.save();
        console.log("Đã tạo dịch vụ: " + req.tenDichVu + " thành công !");
        return success(res, dichVu);
    } catch (err) {
        return error(res, err.message);
    }
}

async function update(req, res) {
    try {
        const { maDichVu, tenDichVu, tonKhoDichVu, giaTriDichVu, giaChoThueDichVu, moTaDichVu, imageDichVu } = req;

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


        const dichVu = await DichVu.updateOne(
            { maDichVu: maDichVu },
            { $set: { tenDichVu: tenDichVu, tonKhoDichVu: tonKhoDichVu, giaDichVu: giaDichVu, giaThueDichVu: giaThueDichVu, moTaDichVu: moTaDichVu, imageDichVu: imageUrl } },
            { new: true } // trả về document sau khi cập nhật
        );

        if (dichVu.matchedCount == 0) {
            return error(res, "Không tìm thấy dịch vụ để cập nhật");
        }

        return success(res, { message: "Đã cập nhật dịch vụ: " + tenDichVu });


    } catch (error) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
    try {
        const { maDichVu } = req;
        const dichVu = await DichVu.findOneAndDelete({ maDichVu: maDichVu });

        if (!dichVu) {
            return error(res, "Không tìm thấy dịch vụ để xóa");
        }

        console.log("Đã xóa dịch vụ:", dichVu.tenDichVu);
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


module.exports = {
    create,
    update,
    remove,
    find
};
