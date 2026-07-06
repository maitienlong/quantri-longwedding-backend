const HopDong = require("../models/hopDong.model");
const KhachHang = require("../models/khachHang.model");
const DichVu = require("../models/dichVu.model");
const Payment = require("../models/payment.model");
const { success, error } = require("../utils/response");

// Helper function to get current date-time string in ICT (+07:00) timezone
function getICTDateTimeString() {
    const now = new Date();
    const tzOffset = 7 * 60; // Offset in minutes for UTC+7 (420 minutes)
    const localTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 60000);
    const localDate = new Date(localTime);
    
    const pad = (n) => n.toString().padStart(2, '0');
    const msPad = (n) => n.toString().padStart(3, '0');
    
    return `${localDate.getFullYear()}-${pad(localDate.getMonth() + 1)}-${pad(localDate.getDate())}T${pad(localDate.getHours())}:${pad(localDate.getMinutes())}:${pad(localDate.getSeconds())}.${msPad(localDate.getMilliseconds())}+07:00`;
}

async function create(req, res) {

    try {
        const hopDong = new HopDong({
            maHopDong: req.body.maHopDong,
            ngayHopDong: getICTDateTimeString(),
            khachHang1: req.body.khachHang1,
            khachHang2: req.body.khachHang2 || undefined,
            gioHang: req.body.gioHang,
            thanhToan: req.body.thanhToan || {},
            cacNgay: req.body.cacNgay,
            nguoiPhucVu: req.body.nguoiPhucVu,
            giaiDoan: req.body.giaiDoan,
            dichVuChinh: req.body.dichVuChinh
        });

        // Xử lý khách thanh toán trước
        const khachThanhToan = req.body.thanhToan.khachThanhToan;
        if (khachThanhToan) {
            let amount = 0;
            let method = "Tiền mặt";
            let noiDung = "Thanh toán trước hợp đồng";
            let date = new Date();
            let paymentId = `TT-${req.body.maHopDong || Date.now()}-${Date.now()}`;

            if (typeof khachThanhToan === "object") {
                amount = Number(khachThanhToan.amount) || 0;
                method = khachThanhToan.method || "Tiền mặt";
                noiDung = khachThanhToan.noiDung || "Thanh toán trước hợp đồng";
                if (khachThanhToan.date) {
                    date = new Date(khachThanhToan.date);
                }
                if (khachThanhToan.id) {
                    paymentId = khachThanhToan.id;
                }
            } else if (typeof khachThanhToan === "number" || !isNaN(Number(khachThanhToan))) {
                amount = Number(khachThanhToan);
            }

            if (amount > 0) {
                // Lấy tên khách hàng
                let khachHangName = "";
                if (req.body.khachHang1) {
                    const kh = await KhachHang.findById(req.body.khachHang1);
                    khachHangName = kh ? kh.tenKhachHang : req.body.khachHang1.toString();
                } else {
                    khachHangName = "Khách hàng";
                }

                // Tạo đối tượng Payment mới trong CSDL
                const newPayment = new Payment({
                    id: paymentId,
                    khachHang: khachHangName,
                    amount: amount,
                    date: date,
                    method: method,
                    noiDung: noiDung
                });
                await newPayment.save();

                // Đẩy vào danh sách các lượt thanh toán của hợp đồng
                if (!hopDong.thanhToan) {
                    hopDong.thanhToan = {};
                }
                if (!hopDong.thanhToan.cacLuotThanhToan) {
                    hopDong.thanhToan.cacLuotThanhToan = [];
                }
                hopDong.thanhToan.cacLuotThanhToan.push({
                    id: paymentId,
                    khachHang: khachHangName,
                    amount: amount,
                    date: date,
                    method: method,
                    noiDung: noiDung
                });

                // Cập nhật lại số tiền khách đã thanh toán
                hopDong.thanhToan.khachHangDaThanhToan = (hopDong.thanhToan.khachHangDaThanhToan || 0) + amount;
            }
        }

        await hopDong.save();
        console.log("Đã tạo hợp đồng mã số: " + req.body.maHopDong + " thành công !");
        return success(res, "Đã tạo hợp đồng mã số: " + req.body.maHopDong + " thành công !", hopDong);
    } catch (err) {
        if (err.code === 11000) {
            return error(res, "Mã hợp đồng đã tồn tại, vui lòng sử dụng mã khác.");
        }
        return error(res, err.message);
    }
}

async function update(req, res) {
    try {
        const { maHopDong, gioHang, thanhToan, nguoiPhucVu, giaiDoan, cacNgay } = req.body;
        const hopDong = await HopDong.findOne({ maHopDong });
        if (!hopDong) return error(res, "Không tìm thấy hợp đồng");

        if (gioHang !== undefined) hopDong.gioHang = gioHang;
        if (cacNgay !== undefined) hopDong.cacNgay = cacNgay;
        if (nguoiPhucVu !== undefined) hopDong.nguoiPhucVu = nguoiPhucVu;
        if (giaiDoan !== undefined) hopDong.giaiDoan = giaiDoan;

        if (thanhToan !== undefined) {
            hopDong.thanhToan = thanhToan;

            if (thanhToan.cacLuotThanhToan && thanhToan.cacLuotThanhToan.length > 0) {
                for (let payment of thanhToan.cacLuotThanhToan) {
                    const existing = await Payment.findOne({ id: payment.id });
                    if (!existing) {
                        const newPayment = new Payment({
                            id: payment.id,
                            khachHang: payment.khachHang || "Khách hàng",
                            amount: Number(payment.amount) || 0,
                            date: payment.date ? new Date(payment.date) : new Date(),
                            method: payment.method || "Tiền mặt",
                            noiDung: payment.noiDung || "Thanh toán thêm"
                        });
                        await newPayment.save();
                    }
                }
            }
        }

        await hopDong.save();

        return success(res, "Đã cập nhật thành công", hopDong);

    } catch (err) {
        return error(res, err.message);
    }
}

async function remove(req, res) {
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

async function pay(req, res) {
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

async function list(req, res) {
    try {
        const { filter } = req.query;
        let query = {};
        const now = new Date();

        if (filter) {
            let startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);

            switch (filter) {
                case 'today': break;
                case 'week':
                    const day = startDate.getDay();
                    const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
                    startDate.setDate(diff);
                    break;
                case 'month':
                    startDate.setDate(1);
                    break;
                case 'year':
                    startDate.setMonth(0, 1);
                    break;
                default:
                    startDate = null;
            }

            if (startDate) {
                query.ngayHopDong = { $gte: startDate };
            }
        }

        // ==========================================
        // SỬ DỤNG .POPULATE() ĐỂ LẤY THÔNG TIN
        // ==========================================
        const hopDong = await HopDong.find(query)
            .populate({
                path: 'khachHang1',      // Tên trường chứa ObjectId của khách hàng 1
                select: 'tenKhachHang soDienThoai' // Chỉ định các trường muốn lấy (ví dụ: tên, SĐT). Cách nhau bằng khoảng trắng.
            })
            .populate({
                path: 'khachHang2',      // Tên trường chứa ObjectId của khách hàng 2
                select: 'tenKhachHang soDienThoai'
            })
            // Tùy chọn: Bạn cũng có thể populate luôn thông tin dịch vụ trong giỏ hàng
            // .populate({
            //     path: 'gioHang.dichVu',
            //     select: 'tenDichVu'
            // })
            .sort({ ngayHopDong: -1 });

        return success(res, "Tải dữ liệu thành công !", {
            filter: filter || "all",
            count: hopDong.length,
            hopDong
        });
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    create,
    update,
    pay,
    remove,
    list
};
