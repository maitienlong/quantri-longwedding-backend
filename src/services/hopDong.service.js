const HopDong = require("../models/hopDongCuoi.model");
const { success, error } = require("../utils/response");

async function taoHDCuoi(req, res) {
    const { maHopDong, ngayKy, ngayChup, ngayAnHoi, ngayCuoi, khachHang, noiDungDichVu, thanhToan } = req;
    try {
        const hopDong = new HopDong({
            maHopDong: maHopDong,
            ngayKy: ngayKy,
            ngayChup: ngayChup,
            ngayAnHoi: ngayAnHoi,
            ngayCuoi: ngayCuoi,
            khachHang: khachHang,
            noiDungDichVu: noiDungDichVu,
            thanhToan: thanhToan
        });
        await hopDong.save();
        console.log("Đã tạo hợp đồng: " + maHopDong + " thành công !");
        return success(res, "Đã tạo hợp đồng: " + maHopDong + " thành công !", hopDong);
    } catch (err) {
        if (err.code === 11000) {
            return error(res, "Mã hợp đồng đã tồn tại, vui lòng sử dụng mã khác.");
        }
        return error(res, err.message);
    }
}

async function capNhatHDCuoi(req, res) {
    try {
        const { maHopDong, ngayChup, ngayAnHoi, ngayCuoi, khachHang, noiDungDichVu } = req;

        const hopDong = await HopDong.updateOne(
            { maHopDong: maHopDong },
            { $set: { ngayChup: ngayChup, ngayAnHoi: ngayAnHoi, ngayCuoi: ngayCuoi, khachHang: khachHang, noiDungDichVu: noiDungDichVu } },
            { new: true } // trả về document sau khi cập nhật
        );

        if (hopDong.matchedCount == 0) {
            return error(res, "Không tìm thấy hợp đồng để cập nhật");
        }

        return success(res, "Đã cập nhật hợp đồng: " + maHopDong);


    } catch (err) {
        return error(res, err.message);
    }
}

async function xoaHDCUoi(req, res) {
    try {
        const { maHopDong } = req;
        const HopDong = await HopDong.findOneAndDelete({ maHopDong: maHopDong });

        if (!HopDong) {
            return error(res, "Không tìm thấy dịch vụ để xóa");
        }

        console.log("Đã xóa dịch vụ:", HopDong.tenHopDong);
        return success(res, { message: "Xóa dịch vụ thành công" });
    } catch (err) {
        return error(res, err.message);
    }
}

async function thanhToanHDCuoi(req, res) {
    try {
        const { maHopDong, luotThanhToan, soTienThanhToan } = req;
        const check = await HopDong.findOne({ maHopDong: maHopDong }, { "thanhToan": 1, _id: 0 });

        switch (luotThanhToan) {
            case "1":

                const check1 = await HopDong.findOne({ maHopDong: maHopDong }, { "thanhToan.thanhToanLan1.soTienDaThanhToan": 1, _id: 0 });
                if (check1.thanhToan.thanhToanLan1.soTienDaThanhToan) {
                    return error(res, "Lượt thanh toán 1 đã được thực hiện, vui lòng chọn lượt thanh toán khác.");
                }
                const hopDong = await HopDong.updateOne({ maHopDong: maHopDong },
                    { $set: { "thanhToan.thanhToanLan1.soTienDaThanhToan": soTienThanhToan, "thanhToan.thanhToanLan2.ngayThanhToan": Date() } },
                    { new: true } // trả về document sau khi cập nhật
                );
                if (hopDong.matchedCount == 0) {
                    return error(res, "Không tìm thấy dịch vụ để cập nhật");
                }
                return success(res, "Khách hàng thanh toán lần 1 thành công với số tiền: " + soTienThanhToan);
            case "2":
                const check1s = await HopDong.findOne({ maHopDong: maHopDong }, { "thanhToan.thanhToanLan1.soTienDaThanhToan": 1, _id: 0 });
                if (!check1s.thanhToan.thanhToanLan1.soTienDaThanhToan) {
                    return error(res, "Lượt thanh toán 1 đã được thực hiện, vui lòng chọn lượt thanh toán khác.");
                }
                const check2 = await HopDong.findOne({ maHopDong: maHopDong }, { "thanhToan.thanhToanLan2.soTienDaThanhToan": 1, _id: 0 });
                if (check2.thanhToan.thanhToanLan1.soTienDaThanhToan) {
                    return error(res, "Lượt thanh toán 1 đã được thực hiện, vui lòng chọn lượt thanh toán khác.");
                }
                const hopDongs = await HopDong.updateOne({ maHopDong: maHopDong },
                    { $set: { "thanhToan.thanhToanLan2.soTienDaThanhToan": soTienThanhToan, "thanhToan.thanhToanLan1.ngayThanhToan": Date() } },
                    { new: true } // trả về document sau khi cập nhật
                );
                if (hopDongs.matchedCount == 0) {
                    return error(res, "Không tìm thấy dịch vụ để cập nhật");
                }
                return success(res, "Khách hàng thanh toán lần 2 thành công với số tiền: " + soTienThanhToan);
            case "3":
                const check1ss = await HopDong.findOne({ maHopDong: maHopDong }, { "thanhToan.thanhToanLan1.soTienDaThanhToan": 1, _id: 0 });
                if (!check1ss.thanhToan.thanhToanLan1.soTienDaThanhToan) {
                    return error(res, "Lượt thanh toán 1 chưa được thực hiện!");
                }
                const check2s = await HopDong.findOne({ maHopDong: maHopDong }, { "thanhToan.thanhToanLan2.soTienDaThanhToan": 1, _id: 0 });
                if (!check2s.thanhToan.thanhToanLan1.soTienDaThanhToan) {
                    return error(res, "Lượt thanh toán 2 chưa được thực hiện!");
                }
                const check3 = await HopDong.findOne({ maHopDong: maHopDong }, { "thanhToan.thanhToanLan3.soTienDaThanhToan": 1, _id: 0 });
                if (check3.thanhToan.thanhToanLan1.soTienDaThanhToan) {
                    return error(res, "Lượt thanh toán 1 đã được thực hiện, vui lòng chọn lượt thanh toán khác.");
                }
                const hopDongss = await HopDong.updateOne({ maHopDong: maHopDong },
                    { $set: { "thanhToan.thanhToanLan3.soTienDaThanhToan": soTienThanhToan, "thanhToan.thanhToanLan1.ngayThanhToan": Date() } },
                    { new: true } // trả về document sau khi cập nhật
                );
                if (hopDongss.matchedCount == 0) {
                    return error(res, "Không tìm thấy dịch vụ để cập nhật");
                }
                return success(res, "Khách hàng thanh toán lần 3 thành công với số tiền: " + soTienThanhToan);
            default:
                return error(res, "Lượt thanh toán không hợp lệ. Vui lòng chọn 1, 2 hoặc 3.");
        }

    } catch (err) {
        return error(res, err.message);
    }
}

async function findAllHDCuoi(req, res) {
    try {
        const { maHopDong } = req;
        const hopDong = await HopDong.findOne({ maHopDong: maHopDong });
        return success(res, {
            count: hopDong.length,
            hopDong
        });
    } catch (err) {
        return error(res, err.message);
    }
}

async function taoHD(req, res) {
    const { maHopDong, ngayKy, ngayChup, ngayAnHoi, ngayCuoi, khachHang, noiDungDichVu, thanhToan } = req;
    try {
        const hopDong = new HopDong({
            maHopDong: maHopDong,
            ngayKy: ngayKy,
            ngayChup: ngayChup,
            ngayAnHoi: ngayAnHoi,
            ngayCuoi: ngayCuoi,
            khachHang: khachHang,
            noiDungDichVu: noiDungDichVu,
            thanhToan: thanhToan
        });
        await hopDong.save();
        console.log("Đã tạo dịch vụ: " + req.tenHopDong + " thành công !");
        return success(res, hopDong);
    } catch (err) {
        if (err.code === 11000) {
            return error(res, "Mã hợp đồng đã tồn tại, vui lòng sử dụng mã khác.");
        }
        return error(res, err.message);
    }
}

async function capNhatHD(req, res) {
    try {
        const { maHopDong, tenHopDong, soLuong, donGia, moTa } = req;

        const HopDong = await HopDong.updateOne(
            { maHopDong: maHopDong },
            { $set: { tenHopDong: tenHopDong, soLuong: soLuong, donGia: donGia, moTa: moTa } },
            { new: true } // trả về document sau khi cập nhật
        );

        if (HopDong.matchedCount == 0) {
            return error(res, "Không tìm thấy dịch vụ để cập nhật");
        }

        return success(res, { message: "Đã cập nhật dịch vụ: " + tenHopDong });


    } catch (error) {
        return error(res, err.message);
    }
}

async function xoaHD(req, res) {
    try {
        const { maHopDong } = req;
        const HopDong = await HopDong.findOneAndDelete({ maHopDong: maHopDong });

        if (!HopDong) {
            return error(res, "Không tìm thấy dịch vụ để xóa");
        }

        console.log("Đã xóa dịch vụ:", HopDong.tenHopDong);
        return success(res, { message: "Xóa dịch vụ thành công" });
    } catch (err) {
        return error(res, err.message);
    }
}

async function thanhToanHD(req, res) {
    try {
        const HopDong = await HopDong.find();
        return {
            success: true, data: {
                count: HopDong.length,
                HopDong
            }
        };
    } catch (err) {
        return error(res, err.message);
    }
}

async function findAllHD(req, res) {
    try {
        const HopDong = await HopDong.find();
        return {
            success: true, data: {
                count: HopDong.length,
                HopDong
            }
        };
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    taoHDCuoi,
    capNhatHDCuoi,
    thanhToanHDCuoi,
    xoaHDCUoi,
    findAllHDCuoi,
    taoHD,
    capNhatHD,
    thanhToanHD,
    xoaHD,
    findAllHD
};
