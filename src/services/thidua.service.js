const User = require("../models/user.model");
const HopDong = require("../models/hopDong.model");
const StoreTarget = require("../models/storeTarget.model");
const { success, error } = require("../utils/response");
const { getICTComponents, makeICTDate } = require("../utils/dateUtils");

// Calculate growth percentage
function calcGrowth(current = 0, previous = 0) {
    const curr = Number(current) || 0;
    const prev = Number(previous) || 0;
    if (prev === 0) {
        if (curr === 0) return 0;
        return curr > 0 ? 100 : -100;
    }
    return Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(1));
}

// Get Date Ranges and Previous Periods
function getDateRanges(timeRange = 'month', customStart, customEnd, refDate = new Date()) {
    const ict = getICTComponents(refDate);
    let startDate, endDate, prevStart, prevEnd, periodKey, periodLabel, totalDays, daysPassed;

    if (timeRange === 'week') {
        const diffToMon = ict.date - (ict.day === 0 ? 6 : ict.day - 1);
        startDate = makeICTDate(ict.year, ict.month, diffToMon, 0, 0, 0, 0);
        endDate = makeICTDate(ict.year, ict.month, diffToMon + 6, 23, 59, 59, 999);

        // Previous week
        prevStart = makeICTDate(ict.year, ict.month, diffToMon - 7, 0, 0, 0, 0);
        prevEnd = makeICTDate(ict.year, ict.month, diffToMon - 1, 23, 59, 59, 999);

        const weekNum = Math.ceil((((startDate - new Date(startDate.getFullYear(), 0, 1)) / 86400000) + 1) / 7);
        periodKey = `${ict.year}-W${String(weekNum).padStart(2, '0')}`;
        periodLabel = `Tuần này (${startDate.getDate()}/${startDate.getMonth()+1} - ${endDate.getDate()}/${endDate.getMonth()+1})`;
        totalDays = 7;
        const currentDayIndex = ict.day === 0 ? 7 : ict.day;
        daysPassed = Math.min(7, Math.max(1, currentDayIndex));
    } else if (timeRange === 'quarter') {
        const currentQuarter = Math.floor(ict.month / 3) + 1;
        const startMonth = (currentQuarter - 1) * 3;
        const endMonth = startMonth + 2;

        startDate = makeICTDate(ict.year, startMonth, 1, 0, 0, 0, 0);
        endDate = makeICTDate(ict.year, endMonth + 1, 0, 23, 59, 59, 999);

        // Previous quarter
        const prevQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
        const prevYear = currentQuarter === 1 ? ict.year - 1 : ict.year;
        const prevStartMonth = (prevQuarter - 1) * 3;
        const prevEndMonth = prevStartMonth + 2;
        prevStart = makeICTDate(prevYear, prevStartMonth, 1, 0, 0, 0, 0);
        prevEnd = makeICTDate(prevYear, prevEndMonth + 1, 0, 23, 59, 59, 999);

        periodKey = `${ict.year}-Q${currentQuarter}`;
        periodLabel = `Quý ${currentQuarter}/${ict.year}`;
        totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        daysPassed = Math.min(totalDays, Math.max(1, Math.round((refDate - startDate) / (1000 * 60 * 60 * 24)) + 1));
    } else if (timeRange === 'year') {
        startDate = makeICTDate(ict.year, 0, 1, 0, 0, 0, 0);
        endDate = makeICTDate(ict.year, 11, 31, 23, 59, 59, 999);

        // Previous year
        prevStart = makeICTDate(ict.year - 1, 0, 1, 0, 0, 0, 0);
        prevEnd = makeICTDate(ict.year - 1, 11, 31, 23, 59, 59, 999);

        periodKey = `${ict.year}`;
        periodLabel = `Năm ${ict.year}`;
        const isLeap = (ict.year % 4 === 0 && ict.year % 100 !== 0) || (ict.year % 400 === 0);
        totalDays = isLeap ? 366 : 365;
        const dayOfYear = Math.floor((refDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        daysPassed = Math.min(totalDays, Math.max(1, dayOfYear));
    } else if (timeRange === 'custom' && customStart && customEnd) {
        startDate = new Date(customStart);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);

        const duration = endDate.getTime() - startDate.getTime();
        prevEnd = new Date(startDate.getTime() - 1);
        prevStart = new Date(prevEnd.getTime() - duration);

        periodKey = `custom-${startDate.toISOString().slice(0, 10)}-${endDate.toISOString().slice(0, 10)}`;
        periodLabel = `Từ ${startDate.toLocaleDateString('vi-VN')} đến ${endDate.toLocaleDateString('vi-VN')}`;
        totalDays = Math.max(1, Math.round(duration / (1000 * 60 * 60 * 24)) + 1);
        daysPassed = totalDays;
    } else {
        // Default: Month
        startDate = makeICTDate(ict.year, ict.month, 1, 0, 0, 0, 0);
        endDate = makeICTDate(ict.year, ict.month + 1, 0, 23, 59, 59, 999);

        // Previous month
        const prevMonth = ict.month === 0 ? 11 : ict.month - 1;
        const prevYear = ict.month === 0 ? ict.year - 1 : ict.year;
        prevStart = makeICTDate(prevYear, prevMonth, 1, 0, 0, 0, 0);
        prevEnd = makeICTDate(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);

        periodKey = `${ict.year}-${String(ict.month + 1).padStart(2, '0')}`;
        periodLabel = `Tháng ${ict.month + 1}/${ict.year}`;
        totalDays = new Date(ict.year, ict.month + 1, 0).getDate();
        daysPassed = Math.min(totalDays, Math.max(1, ict.date));
    }

    const daysRemaining = Math.max(0, totalDays - daysPassed);

    return {
        startDate,
        endDate,
        prevStart,
        prevEnd,
        periodKey,
        periodLabel,
        totalDays,
        daysPassed,
        daysRemaining
    };
}

// Get Thi Dua Stats
async function getThiDuaStats(req, res) {
    try {
        const { timeRange = 'month', startDate: customStart, endDate: customEnd, position } = req.body || {};
        const {
            startDate,
            endDate,
            prevStart,
            prevEnd,
            periodKey,
            periodLabel,
            totalDays,
            daysPassed,
            daysRemaining
        } = getDateRanges(timeRange, customStart, customEnd);

        // 1. Fetch Users
        let userQuery = {};
        if (position && position !== 'Tất cả') {
            userQuery.positon = position;
        }
        const users = await User.find(userQuery).select("-password").sort({ createdAt: -1 }).lean();

        // 2. Fetch Current Period Contracts
        const contracts = await HopDong.find({
            maHopDong: { $ne: "CH-CHUNG" },
            ngayHopDong: { $gte: startDate, $lte: endDate }
        }).lean();

        // 3. Fetch Previous Period Contracts
        const prevContracts = await HopDong.find({
            maHopDong: { $ne: "CH-CHUNG" },
            ngayHopDong: { $gte: prevStart, $lte: prevEnd }
        }).lean();

        // 4. Fetch Store Target
        let storeTarget = await StoreTarget.findOne({ periodKey }).lean();
        if (!storeTarget) {
            // Default target presets
            let defaultTargetRev = 100000000;
            let defaultTargetContracts = 20;
            if (timeRange === 'week') {
                defaultTargetRev = 25000000;
                defaultTargetContracts = 5;
            } else if (timeRange === 'quarter') {
                defaultTargetRev = 300000000;
                defaultTargetContracts = 60;
            } else if (timeRange === 'year') {
                defaultTargetRev = 1200000000;
                defaultTargetContracts = 240;
            }

            storeTarget = {
                periodKey,
                periodType: timeRange,
                targetRevenue: defaultTargetRev,
                targetContracts: defaultTargetContracts,
                targetProfit: Math.round(defaultTargetRev * 0.4),
                growthRateExpected: 15,
                bonusPool: Math.round(defaultTargetRev * 0.03),
                notes: "Mục tiêu bứt phá doanh số và nâng cao chất lượng dịch vụ Long Wedding."
            };
        }

        // 5. Calculate Store Current vs Target Metrics
        let storeTotalRevenue = 0;
        let storeTotalPaid = 0;
        contracts.forEach(hd => {
            const val = Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
            const paid = Number(hd.thanhToan?.khachHangDaThanhToan ?? 0);
            storeTotalRevenue += val;
            storeTotalPaid += paid;
        });
        const storeTotalContracts = contracts.length;
        const storeAverageOrderValue = storeTotalContracts > 0 ? Math.round(storeTotalRevenue / storeTotalContracts) : 0;

        // Previous Period Store Metrics
        let prevTotalRevenue = 0;
        prevContracts.forEach(hd => {
            const val = Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
            prevTotalRevenue += val;
        });
        const prevTotalContracts = prevContracts.length;
        const prevAverageOrderValue = prevTotalContracts > 0 ? Math.round(prevTotalRevenue / prevTotalContracts) : 0;

        // Store Completion & Growth Percentages
        const storeRevPct = storeTarget.targetRevenue > 0 ? Math.round((storeTotalRevenue / storeTarget.targetRevenue) * 100) : 0;
        const storeContractsPct = storeTarget.targetContracts > 0 ? Math.round((storeTotalContracts / storeTarget.targetContracts) * 100) : 0;
        const storeOverallPct = Math.round((storeRevPct * 0.6) + (storeContractsPct * 0.4));

        const revenueGrowthMoM = calcGrowth(storeTotalRevenue, prevTotalRevenue);
        const contractsGrowthMoM = calcGrowth(storeTotalContracts, prevTotalContracts);
        const aovGrowthMoM = calcGrowth(storeAverageOrderValue, prevAverageOrderValue);

        // Run-rate Forecasting
        const dailyAvgRevenue = daysPassed > 0 ? Math.round(storeTotalRevenue / daysPassed) : 0;
        const dailyAvgContracts = daysPassed > 0 ? Number((storeTotalContracts / daysPassed).toFixed(2)) : 0;
        const forecastRevenue = Math.round(dailyAvgRevenue * totalDays);
        const forecastContracts = Math.round(dailyAvgContracts * totalDays);
        const forecastCompletionPct = storeTarget.targetRevenue > 0 ? Math.round((forecastRevenue / storeTarget.targetRevenue) * 100) : 0;

        const remainingRevenueNeeded = Math.max(0, storeTarget.targetRevenue - storeTotalRevenue);
        const remainingContractsNeeded = Math.max(0, storeTarget.targetContracts - storeTotalContracts);
        const requiredDailyRevenue = daysRemaining > 0 ? Math.round(remainingRevenueNeeded / daysRemaining) : 0;
        const requiredDailyContracts = daysRemaining > 0 ? Number((remainingContractsNeeded / daysRemaining).toFixed(2)) : 0;

        // 6. Process Individual Staff Stats
        const departmentSummary = {
            "Nhân viên Sale": { count: 0, jobs: 0, revenue: 0 },
            "Thợ chụp hình": { count: 0, jobs: 0, revenue: 0 },
            "Thợ trang điểm": { count: 0, jobs: 0, revenue: 0 },
            "Thợ chỉnh ảnh": { count: 0, jobs: 0, revenue: 0 },
            "Nhân viên phục vụ": { count: 0, jobs: 0, revenue: 0 },
            "Khác": { count: 0, jobs: 0, revenue: 0 }
        };

        const staffStats = users.map(user => {
            const fullnameClean = (user.fullname || '').trim().toLowerCase();
            const usernameClean = (user.username || '').trim().toLowerCase();

            let countWork = 0;
            let tongDoanhSo = 0;
            const roleBreakdown = {
                sale: 0,
                photo: 0,
                makeup: 0,
                retouch: 0,
                service: 0
            };

            contracts.forEach(contract => {
                const npv = contract.nguoiPhucVu || {};
                const val = Number((contract.thanhToan && contract.thanhToan.tongGiaTriSauGiam) 
                    || (contract.thanhToan && contract.thanhToan.tongGiaTri) 
                    || 0);

                let matchedInContract = false;

                const checkMatch = (staffName) => {
                    if (!staffName) return false;
                    const clean = String(staffName).trim().toLowerCase();
                    return clean === fullnameClean || clean === usernameClean;
                };

                if (checkMatch(npv.banHang)) {
                    roleBreakdown.sale += 1;
                    countWork += 1;
                    tongDoanhSo += val;
                    matchedInContract = true;
                }
                if (checkMatch(npv.thoChupHinh)) {
                    roleBreakdown.photo += 1;
                    if (!matchedInContract) { countWork += 1; tongDoanhSo += val; matchedInContract = true; }
                }
                if (checkMatch(npv.thoMakeUp)) {
                    roleBreakdown.makeup += 1;
                    if (!matchedInContract) { countWork += 1; tongDoanhSo += val; matchedInContract = true; }
                }
                if (checkMatch(npv.thoChinhAnh)) {
                    roleBreakdown.retouch += 1;
                    if (!matchedInContract) { countWork += 1; tongDoanhSo += val; matchedInContract = true; }
                }
                if (checkMatch(npv.phucVu)) {
                    roleBreakdown.service += 1;
                    if (!matchedInContract) { countWork += 1; tongDoanhSo += val; matchedInContract = true; }
                }
            });

            // Target based on period
            let targetWork = 0;
            if (timeRange === 'week') {
                targetWork = user.chiTieuTuan !== undefined ? user.chiTieuTuan : 5;
            } else if (timeRange === 'quarter') {
                targetWork = (user.chiTieuThang !== undefined ? user.chiTieuThang : 20) * 3;
            } else if (timeRange === 'year') {
                targetWork = user.chiTieuNam !== undefined ? user.chiTieuNam : 200;
            } else {
                targetWork = user.chiTieuThang !== undefined ? user.chiTieuThang : 20;
            }

            const completionPercent = targetWork > 0 ? Math.round((countWork / targetWork) * 100) : 0;
            const isExceeded = countWork >= targetWork && targetWork > 0;
            const percentExceeded = isExceeded ? Math.max(0, completionPercent - 100) : 0;

            // Estimated commission calculated per contract with hoaHongTheoLoaiHD support
            let hoaHongEst = 0;
            const customCommissionMap = new Map();
            if (Array.isArray(user.hoaHongTheoLoaiHD)) {
                user.hoaHongTheoLoaiHD.forEach(item => {
                    if (item.loaiHopDongId !== undefined && item.mucHoaHong !== undefined && item.mucHoaHong !== null && item.mucHoaHong !== '') {
                        customCommissionMap.set(Number(item.loaiHopDongId), item);
                    }
                });
            }

            contracts.forEach(contract => {
                const npv = contract.nguoiPhucVu || {};
                const val = Number((contract.thanhToan && contract.thanhToan.tongGiaTriSauGiam) 
                    || (contract.thanhToan && contract.thanhToan.tongGiaTri) 
                    || 0);

                const checkMatch = (staffName) => {
                    if (!staffName) return false;
                    const clean = String(staffName).trim().toLowerCase();
                    return clean === fullnameClean || clean === usernameClean;
                };

                const isAssigned = checkMatch(npv.banHang) || 
                                   checkMatch(npv.thoChupHinh) || 
                                   checkMatch(npv.thoMakeUp) || 
                                   checkMatch(npv.thoChinhAnh) || 
                                   checkMatch(npv.phucVu);

                if (isAssigned) {
                    const typeId = Number(contract.dichVuChinh || 0);
                    if (customCommissionMap.has(typeId)) {
                        const cfg = customCommissionMap.get(typeId);
                        if (Number(cfg.loaiHoaHong) === 1) {
                            hoaHongEst += Math.round((val * Number(cfg.mucHoaHong || 0)) / 100);
                        } else {
                            hoaHongEst += Number(cfg.mucHoaHong || 0);
                        }
                    } else {
                        if (Number(user.loaiHoaHong) === 1) {
                            hoaHongEst += Math.round((val * Number(user.luongHoaHong || 0)) / 100);
                        } else {
                            hoaHongEst += Number(user.luongHoaHong || 0);
                        }
                    }
                }
            });

            // Bonus incentive calculation (Thưởng nóng vượt mốc thi đua)
            let bonusEst = 0;
            if (completionPercent >= 150) {
                bonusEst = Math.max(500000, Math.round(hoaHongEst * 0.15));
            } else if (completionPercent >= 120) {
                bonusEst = Math.max(300000, Math.round(hoaHongEst * 0.10));
            } else if (completionPercent >= 100) {
                bonusEst = Math.max(100000, Math.round(hoaHongEst * 0.05));
            }

            // Total Income Estimated (Hoa hồng + Thưởng thi đua)
            const totalRewardEst = hoaHongEst + bonusEst;

            // Competition Score Index (Điểm tổng hợp thi đua)
            // = (countWork * 10) + min(100, completionPercent) + (percentExceeded * 1.5) + (tongDoanhSo / 2,000,000)
            const competitionScore = Math.round(
                (countWork * 10) +
                Math.min(100, completionPercent) +
                (percentExceeded * 1.5) +
                (tongDoanhSo / 2000000)
            );

            // Honor Title & Status
            let honorTitle = "Đang nỗ lực";
            let honorBadge = "⏳";
            let honorColor = "#64748b";

            if (completionPercent >= 150) {
                honorTitle = "Siêu Sao Bứt Phá";
                honorBadge = "💎";
                honorColor = "#ec4899";
            } else if (completionPercent >= 120) {
                honorTitle = "Chiến Binh Xuất Sắc";
                honorBadge = "🔥";
                honorColor = "#ef4444";
            } else if (completionPercent >= 100) {
                honorTitle = "Ngôi Sao Đạt Chuẩn";
                honorBadge = "⭐";
                honorColor = "#16a34a";
            } else if (completionPercent >= 75) {
                honorTitle = "Tăng Tốc Về Đích";
                honorBadge = "⚡";
                honorColor = "#3b82f6";
            }

            // Aggregate by department
            const deptKey = departmentSummary[user.positon] ? user.positon : "Khác";
            departmentSummary[deptKey].count += 1;
            departmentSummary[deptKey].jobs += countWork;
            departmentSummary[deptKey].revenue += tongDoanhSo;

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
                chiTieuDoanhSoThang: user.chiTieuDoanhSoThang || 0,
                target: targetWork,
                countWork,
                roleBreakdown,
                tongDoanhSo,
                completionPercent,
                isExceeded,
                percentExceeded,
                hoaHongEst,
                bonusEst,
                totalRewardEst,
                competitionScore,
                honorTitle,
                honorBadge,
                honorColor
            };
        });

        // Sort by Competition Score descending (fallback to work count)
        staffStats.sort((a, b) => b.competitionScore - a.competitionScore || b.countWork - a.countWork || b.tongDoanhSo - a.tongDoanhSo);

        // Assign Rank & Medals
        staffStats.forEach((item, idx) => {
            item.rank = idx + 1;
            if (idx === 0) {
                item.medal = "🥇";
                item.medalLabel = "Quán Quân";
                item.honorTitle = "Quán Quân Bứt Phá";
            } else if (idx === 1) {
                item.medal = "🥈";
                item.medalLabel = "Á Quân";
            } else if (idx === 2) {
                item.medal = "🥉";
                item.medalLabel = "Quý Quân";
            }
        });

        const totalWork = staffStats.reduce((acc, curr) => acc + curr.countWork, 0);
        const totalExceededCount = staffStats.filter(s => s.isExceeded).length;
        const totalHoaHongFund = staffStats.reduce((acc, curr) => acc + curr.hoaHongEst, 0);
        const totalBonusFund = staffStats.reduce((acc, curr) => acc + curr.bonusEst, 0);

        // Automated AI Growth Insights
        const insights = [];
        if (storeRevPct >= 100) {
            insights.push({
                type: 'success',
                title: 'Vượt Mục Tiêu Doanh Thu!',
                message: `Cửa hàng đã xuất sắc đạt ${storeRevPct}% chỉ tiêu doanh thu kỳ này (${storeTotalRevenue.toLocaleString('vi-VN')} đ / ${storeTarget.targetRevenue.toLocaleString('vi-VN')} đ).`
            });
        } else if (forecastCompletionPct >= 100) {
            insights.push({
                type: 'info',
                title: 'Dự Báo Cán Đích Thành Công',
                message: `Với tốc độ hiện tại (${dailyAvgRevenue.toLocaleString('vi-VN')} đ/ngày), dự báo cửa hàng sẽ đạt ${forecastRevenue.toLocaleString('vi-VN')} đ (${forecastCompletionPct}% chỉ tiêu) khi kết thúc kỳ.`
            });
        } else {
            insights.push({
                type: 'warning',
                title: 'Cần Tăng Tốc Về Đích',
                message: `Còn ${daysRemaining} ngày để đạt mục tiêu. Toàn đội ngũ cần đạt tối thiểu ${requiredDailyRevenue.toLocaleString('vi-VN')} đ/ngày hoặc ${requiredDailyContracts} hợp đồng/ngày.`
            });
        }

        if (totalExceededCount > 0) {
            insights.push({
                type: 'celebration',
                title: 'Vinh Danh Đội Ngũ Xuất Sắc',
                message: `Có ${totalExceededCount}/${staffStats.length} nhân viên đã vượt chỉ tiêu được giao. Quán quân hiện tại là ${staffStats[0]?.fullname || 'Chưa có'}.`
            });
        }

        return success(res, "Lấy thống kê thi đua & KPI thành công", {
            timeRange,
            periodKey,
            periodLabel,
            startDate,
            endDate,
            timeline: {
                totalDays,
                daysPassed,
                daysRemaining
            },
            store: {
                target: storeTarget,
                actual: {
                    totalRevenue: storeTotalRevenue,
                    totalContracts: storeTotalContracts,
                    totalPaid: storeTotalPaid,
                    averageOrderValue: storeAverageOrderValue
                },
                completion: {
                    revenuePercent: storeRevPct,
                    contractsPercent: storeContractsPct,
                    overallPercent: storeOverallPct
                },
                growthMoM: {
                    revenuePercent: revenueGrowthMoM,
                    contractsPercent: contractsGrowthMoM,
                    aovPercent: aovGrowthMoM,
                    prevRevenue: prevTotalRevenue,
                    prevContracts: prevTotalContracts
                },
                forecast: {
                    dailyAvgRevenue,
                    dailyAvgContracts,
                    forecastRevenue,
                    forecastContracts,
                    forecastCompletionPct,
                    remainingRevenueNeeded,
                    remainingContractsNeeded,
                    requiredDailyRevenue,
                    requiredDailyContracts
                },
                departmentSummary
            },
            summary: {
                totalUsers: staffStats.length,
                totalWork,
                totalExceededCount,
                totalHoaHongFund,
                totalBonusFund,
                totalRewardFund: totalHoaHongFund + totalBonusFund
            },
            insights,
            stats: staffStats
        });
    } catch (err) {
        return error(res, "Lỗi lấy thống kê thi đua & KPI: " + err.message);
    }
}

// Get or Update Store Target
async function getStoreTarget(req, res) {
    try {
        const { periodKey } = req.body || {};
        if (!periodKey) return error(res, "Thiếu periodKey");

        const target = await StoreTarget.findOne({ periodKey }).lean();
        return success(res, "Lấy chỉ tiêu cửa hàng thành công", target || null);
    } catch (err) {
        return error(res, "Lỗi lấy chỉ tiêu cửa hàng: " + err.message);
    }
}

async function updateStoreTarget(req, res) {
    try {
        const {
            periodKey,
            periodType = 'month',
            targetRevenue,
            targetContracts,
            targetProfit,
            growthRateExpected,
            bonusPool,
            notes
        } = req.body || {};

        if (!periodKey) return error(res, "Thiếu periodKey");

        const parts = periodKey.split('-');
        const year = Number(parts[0]) || new Date().getFullYear();
        let month = undefined;
        let quarter = undefined;

        if (parts[1] && parts[1].startsWith('Q')) {
            quarter = Number(parts[1].replace('Q', ''));
        } else if (parts[1]) {
            month = Number(parts[1]);
        }

        const updateData = {
            periodKey,
            periodType,
            year,
            month,
            quarter,
            targetRevenue: Number(targetRevenue) || 0,
            targetContracts: Number(targetContracts) || 0,
            targetProfit: Number(targetProfit) || 0,
            growthRateExpected: Number(growthRateExpected) || 0,
            bonusPool: Number(bonusPool) || 0,
            notes: notes || "",
            updatedBy: req.user?.username || req.user?.fullname || "Admin"
        };

        const target = await StoreTarget.findOneAndUpdate(
            { periodKey },
            { $set: updateData },
            { upsert: true, new: true }
        );

        return success(res, "Cập nhật chỉ tiêu cửa hàng thành công", target);
    } catch (err) {
        return error(res, "Lỗi cập nhật chỉ tiêu cửa hàng: " + err.message);
    }
}

// Batch Update Staff Targets
async function updateBatchTargets(req, res) {
    try {
        const { targets } = req.body; // array of targets
        if (!Array.isArray(targets)) {
            return error(res, "Dữ liệu chỉ tiêu không hợp lệ");
        }

        for (const item of targets) {
            if (!item.username) continue;
            const updateFields = {};
            if (item.chiTieuTuan !== undefined) updateFields.chiTieuTuan = Number(item.chiTieuTuan);
            if (item.chiTieuThang !== undefined) updateFields.chiTieuThang = Number(item.chiTieuThang);
            if (item.chiTieuNam !== undefined) updateFields.chiTieuNam = Number(item.chiTieuNam);
            if (item.chiTieuDoanhSoThang !== undefined) updateFields.chiTieuDoanhSoThang = Number(item.chiTieuDoanhSoThang);
            if (item.luongCoBan !== undefined) updateFields.luongCoBan = Number(item.luongCoBan);
            if (item.luongHoaHong !== undefined) updateFields.luongHoaHong = Number(item.luongHoaHong);
            if (item.loaiHoaHong !== undefined) updateFields.loaiHoaHong = Number(item.loaiHoaHong);
            if (item.heSoThuong !== undefined) updateFields.heSoThuong = Number(item.heSoThuong);

            await User.updateOne({ username: item.username }, { $set: updateFields });
        }

        return success(res, "Cập nhật chỉ tiêu nhân viên hàng loạt thành công");
    } catch (err) {
        return error(res, "Cập nhật chỉ tiêu thất bại: " + err.message);
    }
}

module.exports = {
    getThiDuaStats,
    getStoreTarget,
    updateStoreTarget,
    updateBatchTargets
};
