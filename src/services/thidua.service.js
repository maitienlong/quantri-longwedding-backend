const User = require("../models/user.model");
const HopDong = require("../models/hopDong.model");
const { success, error } = require("../utils/response");

// Helper to get start and end date based on timeRange
function getDateRange(timeRange, customStart, customEnd) {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (timeRange === 'week') {
        const day = now.getDay();
        const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
        startDate = new Date(now.setDate(diffToMon));
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
    } else if (timeRange === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (timeRange === 'custom' && customStart && customEnd) {
        startDate = new Date(customStart);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
    } else {
        // Default: month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    return { startDate, endDate };
}

async function getThiDuaStats(req, res) {
    try {
        const { timeRange = 'month', startDate: customStart, endDate: customEnd, position } = req.body || {};
        const { startDate, endDate } = getDateRange(timeRange, customStart, customEnd);

        // 1. Fetch users
        let userQuery = {};
        if (position && position !== 'Tất cả') {
            userQuery.positon = position;
        }
        const users = await User.find(userQuery).select("-password").sort({ createdAt: -1 });

        // 2. Fetch contracts within date range
        const contracts = await HopDong.find({
            ngayHopDong: { $gte: startDate, $lte: endDate }
        });

        // 3. Process work counts per user
        const stats = users.map(user => {
            const fullnameClean = (user.fullname || '').trim().toLowerCase();
            const usernameClean = (user.username || '').trim().toLowerCase();

            let countWork = 0;
            let tongDoanhSo = 0;

            contracts.forEach(contract => {
                const npv = contract.nguoiPhucVu || {};
                const staffList = [
                    npv.thoChupHinh,
                    npv.thoChinhAnh,
                    npv.thoMakeUp,
                    npv.banHang,
                    npv.phucVu
                ].filter(Boolean).map(s => String(s).trim().toLowerCase());

                // Check if user is matched in any of the service roles for this contract
                const isAssigned = staffList.some(s => s === fullnameClean || s === usernameClean);
                if (isAssigned) {
                    countWork += 1;
                    const val = (contract.thanhToan && contract.thanhToan.tongGiaTriSauGiam) 
                        || (contract.thanhToan && contract.thanhToan.tongGiaTri) 
                        || 0;
                    tongDoanhSo += Number(val) || 0;
                }
            });

            // Target depending on period
            let target = 0;
            if (timeRange === 'week') {
                target = user.chiTieuTuan !== undefined ? user.chiTieuTuan : 5;
            } else if (timeRange === 'year') {
                target = user.chiTieuNam !== undefined ? user.chiTieuNam : 200;
            } else {
                target = user.chiTieuThang !== undefined ? user.chiTieuThang : 20;
            }

            const completionPercent = target > 0 ? Math.round((countWork / target) * 100) : 0;
            const isExceeded = countWork >= target && target > 0;
            const percentExceeded = isExceeded ? Math.max(0, completionPercent - 100) : 0;

            // Estimated commission
            let hoaHongEst = 0;
            if (user.loaiHoaHong === 1) {
                // Percentage of revenue
                hoaHongEst = Math.round((tongDoanhSo * (user.luongHoaHong || 0)) / 100);
            } else {
                // Fixed amount per work
                hoaHongEst = countWork * (user.luongHoaHong || 0);
            }

            return {
                _id: user._id,
                username: user.username,
                fullname: user.fullname || user.username,
                positon: user.positon,
                avatar: user.avatar || "",
                birthday: user.birthday,
                luongCoBan: user.luongCoBan || 0,
                luongHoaHong: user.luongHoaHong || 0,
                loaiHoaHong: user.loaiHoaHong || 0,
                chiTieuTuan: user.chiTieuTuan || 5,
                chiTieuThang: user.chiTieuThang || 20,
                chiTieuNam: user.chiTieuNam || 200,
                target,
                countWork,
                tongDoanhSo,
                completionPercent,
                isExceeded,
                percentExceeded,
                hoaHongEst
            };
        });

        // Sort by work count descending
        stats.sort((a, b) => b.countWork - a.countWork);

        // Assign rank
        stats.forEach((item, idx) => {
            item.rank = idx + 1;
        });

        const totalWork = stats.reduce((acc, curr) => acc + curr.countWork, 0);
        const totalExceededCount = stats.filter(s => s.isExceeded).length;
        const totalHoaHongFund = stats.reduce((acc, curr) => acc + curr.hoaHongEst, 0);

        return success(res, "Lấy thống kê thi đua thành công", {
            timeRange,
            startDate,
            endDate,
            summary: {
                totalUsers: stats.length,
                totalWork,
                totalExceededCount,
                totalHoaHongFund
            },
            stats
        });
    } catch (err) {
        return error(res, "Lỗi lấy thống kê thi đua: " + err.message);
    }
}

async function updateBatchTargets(req, res) {
    try {
        const { targets } = req.body; // array of { username, chiTieuTuan, chiTieuThang, chiTieuNam }
        if (!Array.isArray(targets)) {
            return error(res, "Dữ liệu chỉ tiêu không hợp lệ");
        }

        for (const item of targets) {
            if (!item.username) continue;
            const updateFields = {};
            if (item.chiTieuTuan !== undefined) updateFields.chiTieuTuan = Number(item.chiTieuTuan);
            if (item.chiTieuThang !== undefined) updateFields.chiTieuThang = Number(item.chiTieuThang);
            if (item.chiTieuNam !== undefined) updateFields.chiTieuNam = Number(item.chiTieuNam);
            if (item.luongCoBan !== undefined) updateFields.luongCoBan = Number(item.luongCoBan);
            if (item.luongHoaHong !== undefined) updateFields.luongHoaHong = Number(item.luongHoaHong);
            if (item.loaiHoaHong !== undefined) updateFields.loaiHoaHong = Number(item.loaiHoaHong);

            await User.updateOne({ username: item.username }, { $set: updateFields });
        }

        return success(res, "Cập nhật chỉ tiêu hàng loạt thành công");
    } catch (err) {
        return error(res, "Cập nhật chỉ tiêu thất bại: " + err.message);
    }
}

module.exports = {
    getThiDuaStats,
    updateBatchTargets
};
