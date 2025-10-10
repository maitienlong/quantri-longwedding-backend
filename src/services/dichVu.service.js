const DichVu = require("../models/dichVu.model");
const { success, error } = require("../utils/response");

async function create(req, res) {
    try {
        const dichVu = new DichVu({
            maDichVu: req.maDichVu,
            tenDichVu: req.tenDichVu,
            soLuong: req.soLuong,
            donGia: req.donGia,
            moTa: req.moTa
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
        const { maDichVu, tenDichVu, soLuong, donGia, moTa } = req;

        const dichVu = await DichVu.updateOne(
            { maDichVu: maDichVu },
            { $set: { tenDichVu: tenDichVu, soLuong: soLuong, donGia: donGia, moTa: moTa } },
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

async function findAll(req, res) {
    try {
        const dichVu = await DichVu.find();
        return {
            success: true, data: {
                count: dichVu.length,
                dichVu
            }
        };
    } catch (err) {
        return error(res, err.message);
    }
}


module.exports = {
    create,
    update,
    remove,
    findAll
};
