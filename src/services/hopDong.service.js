const HopDong = require("../models/hopDong.model");
const KhachHang = require("../models/khachHang.model");
const DichVu = require("../models/dichVu.model");
const Payment = require("../models/payment.model");
const Album = require("../models/album.model");
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

function formatICTDateTime(date) {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const tzOffset = 7 * 60; // UTC+7 in minutes
    const ictDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (tzOffset * 60000));
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(ictDate.getHours())}:${pad(ictDate.getMinutes())} ngày ${pad(ictDate.getDate())}/${pad(ictDate.getMonth() + 1)}/${ictDate.getFullYear()}`;
}

async function create(req, res) {

    try {
        // Kiểm tra trùng lịch chụp hình (khoảng cách dưới 3 tiếng)
        if (req.body.cacNgay?.ngayChup) {
            const ngayChupTime = new Date(req.body.cacNgay.ngayChup).getTime();
            if (!isNaN(ngayChupTime)) {
                const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
                const minTime = new Date(ngayChupTime - THREE_HOURS_MS);
                const maxTime = new Date(ngayChupTime + THREE_HOURS_MS);

                const conflictingContract = await HopDong.findOne({
                    giaiDoan: 1,
                    "cacNgay.ngayChup": {
                        $gte: minTime,
                        $lte: maxTime
                    }
                }).populate("khachHang1", "tenKhachHang");

                if (conflictingContract) {
                    const timeStr = formatICTDateTime(conflictingContract.cacNgay.ngayChup);
                    const khachHangName = conflictingContract.khachHang1?.tenKhachHang || "Khách hàng";
                    return error(res, `Không thể lưu hợp đồng! Lịch chụp hình bị trùng hoặc quá gần (dưới 3 tiếng) với HĐ ${conflictingContract.maHopDong} (${khachHangName}) vào lúc ${timeStr}.`);
                }
            }
        }

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
            dichVuChinh: req.body.dichVuChinh,
            isSpecialCollection: req.body.isSpecialCollection || false
        });

        // Xử lý khách thanh toán trước
        const khachThanhToan = req.body.thanhToan?.khachThanhToan;
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
        const { maHopDong, gioHang, thanhToan, nguoiPhucVu, giaiDoan, cacNgay, linkAnhGoc, linkAnhChinhSua, danhSachAnhIn, isSpecialCollection } = req.body;
        const hopDong = await HopDong.findOne({ maHopDong });
        if (!hopDong) return error(res, "Không tìm thấy hợp đồng");

        if (isSpecialCollection !== undefined) hopDong.isSpecialCollection = isSpecialCollection;
        if (gioHang !== undefined) hopDong.gioHang = gioHang;
        if (cacNgay !== undefined) {
            const oldNgayChuyen = hopDong.cacNgay?.ngayChuyenInAnh;
            hopDong.cacNgay = cacNgay;
            if (oldNgayChuyen && !hopDong.cacNgay.ngayChuyenInAnh) {
                hopDong.cacNgay.ngayChuyenInAnh = oldNgayChuyen;
            }
        }
        if (nguoiPhucVu !== undefined) hopDong.nguoiPhucVu = nguoiPhucVu;
        if (giaiDoan !== undefined) {
            if (Number(giaiDoan) === 4 && hopDong.giaiDoan !== 4) {
                if (!hopDong.cacNgay) hopDong.cacNgay = {};
                hopDong.cacNgay.ngayChuyenInAnh = new Date();
            }
            hopDong.giaiDoan = giaiDoan;
        }
        if (linkAnhGoc !== undefined) hopDong.linkAnhGoc = linkAnhGoc;
        if (linkAnhChinhSua !== undefined) hopDong.linkAnhChinhSua = linkAnhChinhSua;
        if (danhSachAnhIn !== undefined) hopDong.danhSachAnhIn = danhSachAnhIn;

        if (thanhToan !== undefined || gioHang !== undefined) {
            const currentThanhToan = hopDong.thanhToan || {};
            const incomingThanhToan = thanhToan || {};

            const giamGia = incomingThanhToan.giamGia !== undefined ? incomingThanhToan.giamGia : (currentThanhToan.giamGia || 0);
            const loaiGiamGia = incomingThanhToan.loaiGiamGia !== undefined ? incomingThanhToan.loaiGiamGia : (currentThanhToan.loaiGiamGia || 0);
            const cacLuotThanhToan = incomingThanhToan.cacLuotThanhToan !== undefined ? incomingThanhToan.cacLuotThanhToan : (currentThanhToan.cacLuotThanhToan || []);

            // Recalculate totals from active cart items
            const activeGioHang = hopDong.gioHang || [];
            const tongGiaTri = activeGioHang.reduce((sum, item) => {
                const price = parseFloat(item.donGia?.toString().replace(/[^0-9.-]+/g, "") || item.giaChoThueDichVu?.toString().replace(/[^0-9.-]+/g, "") || 0);
                const discountItem = parseFloat(item.giamGiaDichVu || 0);
                return sum + Math.max(0, (price * (item.soLuong || 0)) - discountItem);
            }, 0);

            let tongGiaTriSauGiam = tongGiaTri;
            if (Number(loaiGiamGia) === 1) {
                tongGiaTriSauGiam = tongGiaTri - (tongGiaTri * (giamGia / 100));
            } else {
                tongGiaTriSauGiam = tongGiaTri - giamGia;
            }
            if (tongGiaTriSauGiam < 0) tongGiaTriSauGiam = 0;

            // Recalculate total paid
            const khachHangDaThanhToan = cacLuotThanhToan.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const conLai = Math.max(0, tongGiaTriSauGiam - khachHangDaThanhToan);

            hopDong.thanhToan = {
                tongGiaTri,
                giamGia,
                loaiGiamGia,
                tongGiaTriSauGiam,
                khachHangDaThanhToan,
                conLai,
                cacLuotThanhToan
            };

            // Save new payments to Payment collection
            if (cacLuotThanhToan && cacLuotThanhToan.length > 0) {
                for (let payment of cacLuotThanhToan) {
                    if (payment.id) {
                        const existing = await Payment.findOne({ id: payment.id });
                        if (!existing) {
                            const newPayment = new Payment({
                                id: payment.id,
                                khachHang: payment.khachHang || "Khách hàng",
                                amount: Number(payment.amount) || 0,
                                date: payment.date ? new Date(payment.date) : new Date(),
                                method: payment.method || "Tiền mặt",
                                noiDung: payment.noiDung || "Thanh toán"
                            });
                            await newPayment.save();
                        }
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
        const maHopDong = req.body.maHopDong || req.query.maHopDong || req.body;
        if (!maHopDong) {
            return error(res, "Thiếu mã hợp đồng để xóa");
        }
        const deletedHD = await HopDong.findOneAndDelete({ maHopDong: maHopDong });

        if (!deletedHD) {
            return error(res, "Không tìm thấy hợp đồng để xóa");
        }

        // Cũng xóa cả lịch soạn đồ đi kèm nếu có
        try {
            const LichSoanDo = require("../models/lichSoanDo.model");
            await LichSoanDo.findOneAndDelete({ maHopDong: maHopDong });
        } catch (e) {
            console.error("Lỗi khi xóa lịch soạn đồ đi kèm:", e);
        }

        console.log("Đã xóa hợp đồng:", deletedHD.maHopDong);
        return success(res, "Xóa hợp đồng thành công");
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

// Helper functions for ICT date filtering
function getICTStartOfDay() {
    const now = new Date();
    const tzOffset = 7 * 60; // ICT is UTC+7
    const localTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 60000);
    const ictDate = new Date(localTime);
    
    const ictStart = new Date(Date.UTC(
        ictDate.getFullYear(),
        ictDate.getMonth(),
        ictDate.getDate(),
        0, 0, 0, 0
    ));
    
    ictStart.setHours(ictStart.getHours() - 7);
    return ictStart;
}

function getICTStartDateForFilter(filter) {
    if (!filter) return null;
    const startOfToday = getICTStartOfDay();
    
    switch (filter) {
        case 1:
        case '1':
        case 'today':
        case 'hôm nay':
            return startOfToday;
        case 2:
        case '2':
        case 'week':
        case '1week':
        case '1 tuần':
        case 'tuần':
            const weekStart = new Date(startOfToday);
            weekStart.setDate(weekStart.getDate() - 7);
            return weekStart;
        case 3:
        case '3':
        case 'month':
        case '1month':
        case '1 tháng':
        case 'tháng':
            const monthStart = new Date(startOfToday);
            monthStart.setMonth(monthStart.getMonth() - 1);
            return monthStart;
        case 4:
        case '4':
        case '4months':
        case '4month':
        case '4 tháng':
            const fourMonthsStart = new Date(startOfToday);
            fourMonthsStart.setMonth(fourMonthsStart.getMonth() - 4);
            return fourMonthsStart;
        case 'year':
        case 'năm':
            const yearStart = new Date(startOfToday);
            yearStart.setMonth(0, 1);
            return yearStart;
        default:
            return null;
    }
}

function getICTDateRange(period) {
    if (!period) return null;
    const startOfToday = getICTStartOfDay();
    
    let start, end;
    switch (period) {
        case 'today':
        case 'hôm nay': {
            start = startOfToday;
            end = new Date(startOfToday);
            end.setDate(end.getDate() + 1);
            break;
        }
        case 'week':
        case 'this_week':
        case 'tuần':
        case 'tuần này': {
            const now = new Date();
            const tzOffset = 7 * 60;
            const localTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 60000);
            const ictDate = new Date(localTime);
            const day = ictDate.getDay();
            const diffToMonday = ictDate.getDate() - (day === 0 ? 6 : day - 1);
            
            const startOfWeek = new Date(Date.UTC(
                ictDate.getFullYear(),
                ictDate.getMonth(),
                diffToMonday,
                0, 0, 0, 0
            ));
            startOfWeek.setHours(startOfWeek.getHours() - 7);
            
            start = startOfWeek;
            end = new Date(startOfWeek);
            end.setDate(end.getDate() + 7);
            break;
        }
        case 'month':
        case 'this_month':
        case 'tháng':
        case 'tháng này': {
            const now = new Date();
            const tzOffset = 7 * 60;
            const localTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (tzOffset * 60000);
            const ictDate = new Date(localTime);
            
            const startOfMonth = new Date(Date.UTC(
                ictDate.getFullYear(),
                ictDate.getMonth(),
                1,
                0, 0, 0, 0
            ));
            startOfMonth.setHours(startOfMonth.getHours() - 7);
            
            const endOfMonth = new Date(Date.UTC(
                ictDate.getFullYear(),
                ictDate.getMonth() + 1,
                1,
                0, 0, 0, 0
            ));
            endOfMonth.setHours(endOfMonth.getHours() - 7);
            
            start = startOfMonth;
            end = endOfMonth;
            break;
        }
        default:
            return null;
    }
    return { start, end };
}

async function list(req, res) {
    try {
        const filter = req.body.filter || req.query.filter;
        const status = req.body.status || req.query.status || req.body.giaiDoan || req.query.giaiDoan;
        const keyword = req.body.keyword || req.query.keyword || req.body.q || req.query.q;
        const isCalendar = req.body.isCalendar === true || req.body.isCalendar === 'true';
        const dateField = req.body.dateField || req.query.dateField || 'cacNgay.ngayChup';
        const chotLich = req.body.chotLich || req.query.chotLich;
        
        let query = {};

        if (chotLich !== undefined && chotLich !== null && chotLich !== '' && chotLich !== 'all') {
            if (Array.isArray(chotLich)) {
                query['cacNgay.chotLich'] = { $in: chotLich };
            } else {
                query['cacNgay.chotLich'] = chotLich;
            }
        }

        // 1. Lọc theo thời gian
        let dateConditions = null;
        if (isCalendar) {
            if (dateField === 'anHoiVaCuoi') {
                if (filter && filter !== 'all') {
                    const range = getICTDateRange(filter);
                    if (range) {
                        dateConditions = {
                            $or: [
                                { 'cacNgay.ngayAnHoi': { $gte: range.start, $lt: range.end } },
                                { 'cacNgay.ngayCuoi': { $gte: range.start, $lt: range.end } }
                            ]
                        };
                    }
                } else {
                    dateConditions = {
                        $or: [
                            { 'cacNgay.ngayAnHoi': { $exists: true, $ne: null } },
                            { 'cacNgay.ngayCuoi': { $exists: true, $ne: null } }
                        ]
                    };
                }
            } else {
                if (filter && filter !== 'all') {
                    const range = getICTDateRange(filter);
                    if (range) {
                        query[dateField] = { $gte: range.start, $lt: range.end };
                    }
                } else {
                    query[dateField] = { $exists: true, $ne: null };
                }
            }
        } else {
            if (filter && filter !== 'all') {
                const startDate = getICTStartDateForFilter(filter);
                if (startDate) {
                    query.ngayHopDong = { $gte: startDate };
                }
            }
        }

        // 2. Lọc theo trạng thái
        if (status !== undefined && status !== null && status !== '' && status !== 'all') {
            if (Array.isArray(status)) {
                query.giaiDoan = { $in: status.map(Number) };
            } else {
                query.giaiDoan = Number(status);
            }
        }

        // 3. Tìm kiếm theo từ khóa (mã hợp đồng, số điện thoại, tên khách hàng)
        let keywordConditions = null;
        if (keyword) {
            const customers = await KhachHang.find({
                $or: [
                    { soDienThoai: { $regex: keyword, $options: 'i' } },
                    { tenKhachHang: { $regex: keyword, $options: 'i' } }
                ]
            });
            const customerIds = customers.map(c => c._id);
            
            keywordConditions = {
                $or: [
                    { maHopDong: { $regex: keyword, $options: 'i' } },
                    { khachHang1: { $in: customerIds } },
                    { khachHang2: { $in: customerIds } }
                ]
            };
        }

        // Kết hợp dateConditions và keywordConditions
        if (dateConditions && keywordConditions) {
            query.$and = [dateConditions, keywordConditions];
        } else if (dateConditions) {
            Object.assign(query, dateConditions);
        } else if (keywordConditions) {
            Object.assign(query, keywordConditions);
        }

        // ==========================================
        // SỬ DỤNG .POPULATE() ĐỂ LẤY THÔNG TIN
        // ==========================================
        let sortQuery = { ngayHopDong: -1 };
        if (isCalendar) {
            if (dateField === 'anHoiVaCuoi') {
                sortQuery = { 'cacNgay.ngayAnHoi': 1, 'cacNgay.ngayCuoi': 1 };
            } else {
                sortQuery = { [dateField]: 1 };
            }
        }

        const hopDong = await HopDong.find(query)
            .populate({
                path: 'khachHang1',      // Tên trường chứa ObjectId của khách hàng 1
                select: 'tenKhachHang soDienThoai diaChi facebookId' // Chỉ định các trường muốn lấy
            })
            .populate({
                path: 'khachHang2',      // Tên trường chứa ObjectId của khách hàng 2
                select: 'tenKhachHang soDienThoai diaChi facebookId'
            })
            .populate({
                path: 'gioHang.dichVu',
                select: 'loaiDichVu tenDichVu giaChoThueDichVu maDichVu'
            })
            .sort(sortQuery);

        return success(res, "Tải dữ liệu thành công !", {
            filter: filter || "all",
            status: status || "all",
            keyword: keyword || "",
            count: hopDong.length,
            hopDong
        });
    } catch (err) {
        return error(res, err.message);
    }
}

async function search(req, res) {
    try {
        const keyword = req.body.keyword || req.query.keyword || req.body.q || req.query.q;
        const maHopDong = req.body.maHopDong || req.query.maHopDong;
        const soDienThoai = req.body.soDienThoai || req.query.soDienThoai;
        
        let query = {};
        
        if (keyword) {
            // Tìm kiếm khách hàng theo số điện thoại hoặc tên khách hàng (chứa keyword)
            const customers = await KhachHang.find({
                $or: [
                    { soDienThoai: { $regex: keyword, $options: 'i' } },
                    { tenKhachHang: { $regex: keyword, $options: 'i' } }
                ]
            });
            const customerIds = customers.map(c => c._id);
            
            // Tìm kiếm theo mã hợp đồng hoặc khách hàng có ID trong danh sách
            query = {
                $or: [
                    { maHopDong: { $regex: keyword, $options: 'i' } },
                    { khachHang1: { $in: customerIds } },
                    { khachHang2: { $in: customerIds } }
                ]
            };
        } else {
            let orConditions = [];
            if (maHopDong) {
                orConditions.push({ maHopDong: { $regex: maHopDong, $options: 'i' } });
            }
            if (soDienThoai) {
                const customers = await KhachHang.find({
                    soDienThoai: { $regex: soDienThoai, $options: 'i' }
                });
                const customerIds = customers.map(c => c._id);
                orConditions.push({ khachHang1: { $in: customerIds } });
                orConditions.push({ khachHang2: { $in: customerIds } });
            }
            
            if (orConditions.length > 0) {
                query = { $or: orConditions };
            }
        }
        
        const hopDong = await HopDong.find(query)
            .populate({
                path: 'khachHang1',
                select: 'tenKhachHang soDienThoai'
            })
            .populate({
                path: 'khachHang2',
                select: 'tenKhachHang soDienThoai'
            })
            .populate({
                path: 'gioHang.dichVu',
                select: 'loaiDichVu tenDichVu giaChoThueDichVu maDichVu'
            })
            .sort({ ngayHopDong: -1 });
            
        return success(res, "Tìm kiếm hợp đồng thành công !", {
            count: hopDong.length,
            hopDong
        });
    } catch (err) {
        return error(res, err.message);
    }
}

async function updateProgress(req, res) {
    try {
        const { maHopDong, giaiDoan, data, dichVuChinh } = req.body;
        const hopDong = await HopDong.findOne({ maHopDong });
        if (!hopDong) return error(res, "Không tìm thấy hợp đồng");

        if (dichVuChinh !== undefined) {
            hopDong.dichVuChinh = Number(dichVuChinh);
        }

        const currentStage = hopDong.giaiDoan;
        const nextStage = Number(giaiDoan);

        if (nextStage < 1 || nextStage > 5) {
            return error(res, "Giai đoạn không hợp lệ (phải từ 1 đến 5)");
        }

        // Không cho phép đi lùi giai đoạn
        if (nextStage < currentStage) {
            return error(res, `Không thể quay lại giai đoạn trước đó (Hiện tại: ${currentStage}, Yêu cầu chuyển: ${nextStage})`);
        }

        // Kiểm tra quy tắc chuyển tiếp giai đoạn tuần tự (cho phép bỏ qua 4 để lên thẳng 5)
        if (nextStage !== currentStage) {
            const isAnhThe = Number(hopDong.dichVuChinh) === 5;
            if (isAnhThe) {
                if (currentStage === 5) {
                    return error(res, "Hợp đồng đã hoàn thành (5), không thể thay đổi giai đoạn");
                }
            } else {
                if (currentStage === 1 && nextStage !== 2) {
                    return error(res, "Hợp đồng mới tạo (1) phải chuyển sang giai đoạn Chụp hình (2)");
                }
                if (currentStage === 2 && nextStage !== 3) {
                    return error(res, "Từ giai đoạn Chụp hình (2) phải chuyển sang giai đoạn Hậu kỳ (3)");
                }
                if (currentStage === 3 && nextStage !== 4 && nextStage !== 5) {
                    return error(res, "Từ giai đoạn Hậu kỳ (3) chỉ được chuyển sang In ảnh (4) hoặc Hoàn thành (5)");
                }
                if (currentStage === 4 && nextStage !== 5) {
                    return error(res, "Từ giai đoạn In ảnh (4) chỉ được chuyển sang Hoàn thành (5)");
                }
                if (currentStage === 5) {
                    return error(res, "Hợp đồng đã hoàn thành (5), không thể thay đổi giai đoạn");
                }
            }
        }

        // Cập nhật dữ liệu tương ứng với từng giai đoạn chuyển tiếp
        if (nextStage === 2) {
            if (!data || !data.linkAnhGoc) {
                return error(res, "Cần cung cấp đường dẫn ảnh gốc cho giai đoạn Chụp hình (2)");
            }
            hopDong.linkAnhGoc = data.linkAnhGoc;
        }

        if (nextStage === 3) {
            if (!data || !data.linkAnhChinhSua) {
                return error(res, "Cần cung cấp đường dẫn ảnh chỉnh sửa cho giai đoạn Hậu kỳ (3)");
            }
            hopDong.linkAnhChinhSua = data.linkAnhChinhSua;
        }

        if (nextStage === 4) {
            if (!data || !Array.isArray(data.danhSachAnhIn) || data.danhSachAnhIn.length === 0) {
                return error(res, "Cần cung cấp danh sách ảnh in cho giai đoạn In ảnh (4)");
            }
            for (let item of data.danhSachAnhIn) {
                if (!item.kichThuoc || typeof item.soLuong !== 'number' || item.soLuong <= 0) {
                    return error(res, "Mỗi ảnh in cần có kích thước và số lượng hợp lệ");
                }
            }
            hopDong.danhSachAnhIn = data.danhSachAnhIn;
            if (!hopDong.cacNgay) hopDong.cacNgay = {};
            hopDong.cacNgay.ngayChuyenInAnh = new Date();
        }

        hopDong.giaiDoan = nextStage;
        await hopDong.save();

        return success(res, "Cập nhật tiến trình hợp đồng thành công !", hopDong);

    } catch (err) {
        return error(res, err.message);
    }
}

async function getCustomerContracts(req, res) {
    try {
        const customerId = req.user.id;
        if (!customerId) return error(res, "Không xác định được khách hàng");

        const query = {
            $or: [
                { khachHang1: customerId },
                { khachHang2: customerId }
            ]
        };

        const hopDong = await HopDong.find(query)
            .populate({
                path: 'khachHang1',
                select: 'tenKhachHang soDienThoai'
            })
            .populate({
                path: 'khachHang2',
                select: 'tenKhachHang soDienThoai'
            })
            .populate({
                path: 'gioHang.dichVu',
                select: 'loaiDichVu tenDichVu giaChoThueDichVu maDichVu'
            })
            .sort({ ngayHopDong: -1 })
            .lean(); // Use lean to modify the objects

        // Attach album data to each contract if exists
        for (let contract of hopDong) {
            const album = await Album.findOne({ maHopDong: contract.maHopDong }).lean();
            if (album) {
                contract.album = {
                    publicLink: album.publicLink,
                    trangThai: album.trangThai,
                    trangThaiChinhSua: album.trangThaiChinhSua,
                    soLuongAnh: album.danhSachAnh ? album.danhSachAnh.length : 0,
                    khachHangXacNhan: album.khachHangXacNhan
                };
            }
        }

        return success(res, "Lấy danh sách hợp đồng thành công!", hopDong);
    } catch (err) {
        return error(res, err.message);
    }
}

module.exports = {
    create,
    update,
    pay,
    remove,
    list,
    search,
    updateProgress,
    getCustomerContracts
};
