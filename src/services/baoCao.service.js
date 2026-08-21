const HopDong = require("../models/hopDong.model");
const ChiTieu = require("../models/chiTieu.model");
const Payment = require("../models/payment.model");
const User = require("../models/user.model");
const { success, error } = require("../utils/response");

// =========================================================================
// TIMEZONE & DATE HELPER FUNCTIONS (ICT UTC+7)
// =========================================================================

function getICTComponents(date = new Date()) {
    const tzOffset = 7 * 60; // ICT is UTC+7 in minutes
    const localTime = date.getTime() + (date.getTimezoneOffset() * 60000) + (tzOffset * 60000);
    const ictDate = new Date(localTime);
    return {
        year: ictDate.getFullYear(),
        month: ictDate.getMonth(), // 0-11
        date: ictDate.getDate(),   // 1-31
        day: ictDate.getDay(),     // 0 (Sun) - 6 (Sat)
        hours: ictDate.getHours(),
        minutes: ictDate.getMinutes()
    };
}

function makeICTDate(year, month, date, hours = 0, minutes = 0, seconds = 0, ms = 0) {
    const d = new Date(Date.UTC(year, month, date, hours, minutes, seconds, ms));
    d.setUTCHours(d.getUTCHours() - 7);
    return d;
}

function getWeekRange(refDate = new Date(), offset = 0) {
    const ict = getICTComponents(refDate);
    const diffToMonday = ict.date - (ict.day === 0 ? 6 : ict.day - 1) + (offset * 7);

    const startDate = makeICTDate(ict.year, ict.month, diffToMonday, 0, 0, 0, 0);
    const endDate = makeICTDate(ict.year, ict.month, diffToMonday + 6, 23, 59, 59, 999);

    const startIct = getICTComponents(startDate);
    const endIct = getICTComponents(endDate);
    const label = `Tuần ${offset === 0 ? 'này' : offset === -1 ? 'trước' : ''} (${startIct.date}/${startIct.month + 1} - ${endIct.date}/${endIct.month + 1})`;

    return { startDate, endDate, label, type: 'week' };
}

function getMonthRange(refDate = new Date(), offset = 0) {
    const ict = getICTComponents(refDate);
    const targetMonth = ict.month + offset;
    const targetYear = ict.year;

    const startDate = makeICTDate(targetYear, targetMonth, 1, 0, 0, 0, 0);
    const endDate = makeICTDate(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    const startIct = getICTComponents(startDate);
    const label = `Tháng ${startIct.month + 1}/${startIct.year}`;

    return { startDate, endDate, label, type: 'month', month: startIct.month + 1, year: startIct.year };
}

function getQuarterRange(refDate = new Date(), offset = 0) {
    const ict = getICTComponents(refDate);
    const currentQuarter = Math.floor(ict.month / 3) + 1;
    
    const totalQuarters = (ict.year * 4 + (currentQuarter - 1)) + offset;
    const targetYear = Math.floor(totalQuarters / 4);
    const targetQuarter = (totalQuarters % 4) + 1;

    const startMonth = (targetQuarter - 1) * 3;
    const endMonth = startMonth + 2;

    const startDate = makeICTDate(targetYear, startMonth, 1, 0, 0, 0, 0);
    const endDate = makeICTDate(targetYear, endMonth + 1, 0, 23, 59, 59, 999);

    const label = `Quý ${targetQuarter}/${targetYear}`;

    return { startDate, endDate, label, type: 'quarter', quarter: targetQuarter, year: targetYear };
}

function getYearRange(refDate = new Date(), offset = 0) {
    const ict = getICTComponents(refDate);
    const targetYear = ict.year + offset;

    const startDate = makeICTDate(targetYear, 0, 1, 0, 0, 0, 0);
    const endDate = makeICTDate(targetYear, 11, 31, 23, 59, 59, 999);

    const label = `Năm ${targetYear}`;

    return { startDate, endDate, label, type: 'year', year: targetYear };
}

function calcGrowth(current = 0, previous = 0) {
    const curr = Number(current) || 0;
    const prev = Number(previous) || 0;

    if (prev === 0) {
        if (curr === 0) return 0;
        return curr > 0 ? 100 : -100;
    }
    return Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(1));
}

function getTrend(current = 0, previous = 0) {
    const curr = Number(current) || 0;
    const prev = Number(previous) || 0;
    if (curr > prev) return 'up';
    if (curr < prev) return 'down';
    return 'neutral';
}

// =========================================================================
// CORE STATS COMPUTATION FOR A DATE RANGE
// =========================================================================

async function computeMetricsForRange(startDate, endDate) {
    // 1. Fetch contracts in range
    const contracts = await HopDong.find({
        maHopDong: { $ne: "CH-CHUNG" },
        ngayHopDong: { $gte: startDate, $lte: endDate }
    }).select("maHopDong ngayHopDong thanhToan nguoiPhucVu giaiDoan dichVuChinh cacLuotChi").lean();

    const soLuongHopDong = contracts.length;

    let tongTienHopDong = 0;
    let daThuCuaHDKy = 0;
    let conNoCuaHDKy = 0;

    contracts.forEach(hd => {
        const val = Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
        const paid = Number(hd.thanhToan?.khachHangDaThanhToan ?? 0);
        const debt = Number(hd.thanhToan?.conLai ?? Math.max(0, val - paid));

        tongTienHopDong += val;
        daThuCuaHDKy += paid;
        conNoCuaHDKy += debt;
    });

    // 2. Fetch expenses in range
    const expenses = await ChiTieu.find({
        date: { $gte: startDate, $lte: endDate }
    }).lean();

    let expenseMap = new Map();
    expenses.forEach(e => {
        const key = e.id || `${e.receiver}-${e.amount}-${new Date(e.date).getTime()}`;
        expenseMap.set(key, Number(e.amount) || 0);
    });

    const contractsWithExpenses = await HopDong.find({
        "cacLuotChi.date": { $gte: startDate, $lte: endDate }
    }).select("maHopDong cacLuotChi").lean();

    contractsWithExpenses.forEach(hd => {
        const list = hd.cacLuotChi || [];
        list.forEach(c => {
            if (c.date) {
                const cDate = new Date(c.date);
                if (cDate >= startDate && cDate <= endDate) {
                    const key = c.id || `${hd.maHopDong}-${c.amount}-${cDate.getTime()}`;
                    if (!expenseMap.has(key)) {
                        expenseMap.set(key, Number(c.amount) || 0);
                    }
                }
            }
        });
    });

    let tongTienKhoanChi = 0;
    for (let amt of expenseMap.values()) {
        tongTienKhoanChi += amt;
    }

    const soTienDaThu = daThuCuaHDKy;
    // Lãi ròng = Doanh số hợp đồng - Tổng tiền chi
    const laiRong = tongTienHopDong - tongTienKhoanChi;
    const tySuatLaiRong = tongTienHopDong > 0 ? Number(((laiRong / tongTienHopDong) * 100).toFixed(1)) : 0;

    return {
        startDate,
        endDate,
        soLuongHopDong,
        tongTienHopDong,
        soTienDaThu,
        soTienConNo: conNoCuaHDKy,
        tongTienKhoanChi,
        laiRong,
        tySuatLaiRong
    };
}

function buildComparison(current, previous) {
    return {
        soLuongHopDong: {
            current: current.soLuongHopDong,
            previous: previous.soLuongHopDong,
            diff: current.soLuongHopDong - previous.soLuongHopDong,
            growthPercent: calcGrowth(current.soLuongHopDong, previous.soLuongHopDong),
            trend: getTrend(current.soLuongHopDong, previous.soLuongHopDong)
        },
        tongTienHopDong: {
            current: current.tongTienHopDong,
            previous: previous.tongTienHopDong,
            diff: current.tongTienHopDong - previous.tongTienHopDong,
            growthPercent: calcGrowth(current.tongTienHopDong, previous.tongTienHopDong),
            trend: getTrend(current.tongTienHopDong, previous.tongTienHopDong)
        },
        soTienDaThu: {
            current: current.soTienDaThu,
            previous: previous.soTienDaThu,
            diff: current.soTienDaThu - previous.soTienDaThu,
            growthPercent: calcGrowth(current.soTienDaThu, previous.soTienDaThu),
            trend: getTrend(current.soTienDaThu, previous.soTienDaThu)
        },
        soTienConNo: {
            current: current.soTienConNo,
            previous: previous.soTienConNo,
            diff: current.soTienConNo - previous.soTienConNo,
            growthPercent: calcGrowth(current.soTienConNo, previous.soTienConNo),
            trend: getTrend(current.soTienConNo, previous.soTienConNo)
        },
        tongTienKhoanChi: {
            current: current.tongTienKhoanChi,
            previous: previous.tongTienKhoanChi,
            diff: current.tongTienKhoanChi - previous.tongTienKhoanChi,
            growthPercent: calcGrowth(current.tongTienKhoanChi, previous.tongTienKhoanChi),
            trend: getTrend(current.tongTienKhoanChi, previous.tongTienKhoanChi)
        },
        laiRong: {
            current: current.laiRong,
            previous: previous.laiRong,
            diff: current.laiRong - previous.laiRong,
            growthPercent: calcGrowth(current.laiRong, previous.laiRong),
            trend: getTrend(current.laiRong, previous.laiRong)
        }
    };
}

// =========================================================================
// TIMELINE CHART DATA GENERATION
// =========================================================================

async function generateTimelineChartData(periodType, startDate, endDate, refDate = new Date()) {
    const chartData = [];
    const ict = getICTComponents(refDate);

    if (periodType === 'week') {
        const dayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
        for (let i = 0; i < 7; i++) {
            const dStart = new Date(startDate);
            dStart.setDate(dStart.getDate() + i);
            dStart.setHours(0, 0, 0, 0);

            const dEnd = new Date(dStart);
            dEnd.setHours(23, 59, 59, 999);

            const metrics = await computeMetricsForRange(dStart, dEnd);
            const dIct = getICTComponents(dStart);
            chartData.push({
                label: dayNames[i],
                subLabel: `${dIct.date}/${dIct.month + 1}`,
                date: dStart,
                ...metrics
            });
        }
    } else if (periodType === 'month') {
        const daysInMonth = new Date(ict.year, ict.month + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dStart = makeICTDate(ict.year, ict.month, d, 0, 0, 0, 0);
            const dEnd = makeICTDate(ict.year, ict.month, d, 23, 59, 59, 999);

            const metrics = await computeMetricsForRange(dStart, dEnd);
            chartData.push({
                label: `${d}`,
                subLabel: `${d}/${ict.month + 1}`,
                date: dStart,
                ...metrics
            });
        }
    } else if (periodType === 'quarter') {
        const currentQuarter = Math.floor(ict.month / 3) + 1;
        const startMonth = (currentQuarter - 1) * 3;
        for (let m = 0; m < 3; m++) {
            const mIndex = startMonth + m;
            const dStart = makeICTDate(ict.year, mIndex, 1, 0, 0, 0, 0);
            const dEnd = makeICTDate(ict.year, mIndex + 1, 0, 23, 59, 59, 999);

            const metrics = await computeMetricsForRange(dStart, dEnd);
            chartData.push({
                label: `Tháng ${mIndex + 1}`,
                subLabel: `Th${mIndex + 1}/${ict.year}`,
                date: dStart,
                ...metrics
            });
        }
    } else if (periodType === 'year') {
        for (let m = 0; m < 12; m++) {
            const dStart = makeICTDate(ict.year, m, 1, 0, 0, 0, 0);
            const dEnd = makeICTDate(ict.year, m + 1, 0, 23, 59, 59, 999);

            const metrics = await computeMetricsForRange(dStart, dEnd);
            chartData.push({
                label: `Th${m + 1}`,
                subLabel: `Tháng ${m + 1}`,
                date: dStart,
                ...metrics
            });
        }
    }

    return chartData;
}

async function getTopPerformers(startDate, endDate) {
    const contracts = await HopDong.find({
        maHopDong: { $ne: "CH-CHUNG" },
        ngayHopDong: { $gte: startDate, $lte: endDate }
    }).select("maHopDong thanhToan nguoiPhucVu").lean();

    const saleMap = {};

    contracts.forEach(hd => {
        const saleName = (hd.nguoiPhucVu?.banHang || "Chưa phân công").trim();
        const val = Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
        const paid = Number(hd.thanhToan?.khachHangDaThanhToan ?? 0);

        if (!saleMap[saleName]) {
            saleMap[saleName] = { name: saleName, count: 0, revenue: 0, collected: 0 };
        }
        saleMap[saleName].count += 1;
        saleMap[saleName].revenue += val;
        saleMap[saleName].collected += paid;
    });

    const rankings = Object.values(saleMap);
    rankings.sort((a, b) => b.revenue - a.revenue);
    return rankings;
}

async function getTopCustomers(startDate, endDate) {
    const contracts = await HopDong.find({
        maHopDong: { $ne: "CH-CHUNG" },
        ngayHopDong: { $gte: startDate, $lte: endDate }
    })
    .populate("khachHang1", "tenKhachHang soDienThoai diaChi")
    .populate("gioHang.dichVu", "tenDichVu")
    .lean();

    const customerMap = {};

    contracts.forEach(hd => {
        const cust = hd.khachHang1 || {};
        const custId = cust._id?.toString() || cust.soDienThoai || hd.maHopDong;
        const custName = cust.tenKhachHang || ("Khách hàng " + hd.maHopDong);
        const custPhone = cust.soDienThoai || "-";
        const custAddress = cust.diaChi || "-";

        const val = Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
        const paid = Number(hd.thanhToan?.khachHangDaThanhToan ?? 0);
        const debt = Number(hd.thanhToan?.conLai ?? Math.max(0, val - paid));

        if (!customerMap[custId]) {
            customerMap[custId] = {
                id: custId,
                name: custName,
                phone: custPhone,
                address: custAddress,
                contractCount: 0,
                serviceCount: 0,
                services: new Set(),
                totalSpent: 0,
                totalPaid: 0,
                totalDebt: 0,
                contractCodes: [],
                lastDate: hd.ngayHopDong
            };
        }

        customerMap[custId].contractCount += 1;
        customerMap[custId].totalSpent += val;
        customerMap[custId].totalPaid += paid;
        customerMap[custId].totalDebt += debt;
        customerMap[custId].contractCodes.push(hd.maHopDong);
        if (new Date(hd.ngayHopDong) > new Date(customerMap[custId].lastDate)) {
            customerMap[custId].lastDate = hd.ngayHopDong;
        }

        if (hd.gioHang && Array.isArray(hd.gioHang)) {
            hd.gioHang.forEach(item => {
                const sName = item.tenDichVuSnapshot || item.dichVu?.tenDichVu;
                if (sName) {
                    customerMap[custId].services.add(sName);
                }
                customerMap[custId].serviceCount += (Number(item.soLuong) || 1);
            });
        }
        if (customerMap[custId].serviceCount === 0) {
            customerMap[custId].serviceCount = customerMap[custId].contractCount;
        }
    });

    const list = Object.values(customerMap).map(c => ({
        ...c,
        services: Array.from(c.services)
    }));

    // Sắp xếp: Ưu tiên khách có số lượng dịch vụ nhiều nhất, sau đó đến tổng chi tiêu cao nhất
    list.sort((a, b) => {
        if (b.serviceCount !== a.serviceCount) {
            return b.serviceCount - a.serviceCount;
        }
        return b.totalSpent - a.totalSpent;
    });

    return list;
}

// =========================================================================
// MAIN CONTROLLER FUNCTION: GET BUSINESS REPORT
// =========================================================================

async function getBaoCaoKinhDoanh(req, res) {
    try {
        const {
            periodType = 'month',
            year: customYear,
            month: customMonth,
            quarter: customQuarter,
            startDate: customStart,
            endDate: customEnd
        } = req.body || {};

        const now = new Date();

        // 1. Calculate All 4 Cycle Overviews (Tuần, Tháng, Quý, Năm)
        const curWeek = getWeekRange(now, 0);
        const prevWeek = getWeekRange(now, -1);
        const [statsCurWeek, statsPrevWeek] = await Promise.all([
            computeMetricsForRange(curWeek.startDate, curWeek.endDate),
            computeMetricsForRange(prevWeek.startDate, prevWeek.endDate)
        ]);

        const curMonth = getMonthRange(now, 0);
        const prevMonth = getMonthRange(now, -1);
        const [statsCurMonth, statsPrevMonth] = await Promise.all([
            computeMetricsForRange(curMonth.startDate, curMonth.endDate),
            computeMetricsForRange(prevMonth.startDate, prevMonth.endDate)
        ]);

        const curQuarter = getQuarterRange(now, 0);
        const prevQuarter = getQuarterRange(now, -1);
        const [statsCurQuarter, statsPrevQuarter] = await Promise.all([
            computeMetricsForRange(curQuarter.startDate, curQuarter.endDate),
            computeMetricsForRange(prevQuarter.startDate, prevQuarter.endDate)
        ]);

        const curYear = getYearRange(now, 0);
        const prevYear = getYearRange(now, -1);
        const [statsCurYear, statsPrevYear] = await Promise.all([
            computeMetricsForRange(curYear.startDate, curYear.endDate),
            computeMetricsForRange(prevYear.startDate, prevYear.endDate)
        ]);

        const overview = {
            week: {
                currentRange: curWeek,
                previousRange: prevWeek,
                current: statsCurWeek,
                previous: statsPrevWeek,
                comparison: buildComparison(statsCurWeek, statsPrevWeek)
            },
            month: {
                currentRange: curMonth,
                previousRange: prevMonth,
                current: statsCurMonth,
                previous: statsPrevMonth,
                comparison: buildComparison(statsCurMonth, statsPrevMonth)
            },
            quarter: {
                currentRange: curQuarter,
                previousRange: prevQuarter,
                current: statsCurQuarter,
                previous: statsPrevQuarter,
                comparison: buildComparison(statsCurQuarter, statsPrevQuarter)
            },
            year: {
                currentRange: curYear,
                previousRange: prevYear,
                current: statsCurYear,
                previous: statsPrevYear,
                comparison: buildComparison(statsCurYear, statsPrevYear)
            }
        };

        // 2. Compute Selected Period Drilldown Data
        let selectedCurrentRange, selectedPreviousRange;

        if (periodType === 'week') {
            selectedCurrentRange = curWeek;
            selectedPreviousRange = prevWeek;
        } else if (periodType === 'quarter') {
            if (customQuarter && customYear) {
                const dummyDate = makeICTDate(Number(customYear), (Number(customQuarter) - 1) * 3, 15);
                selectedCurrentRange = getQuarterRange(dummyDate, 0);
                selectedPreviousRange = getQuarterRange(dummyDate, -1);
            } else {
                selectedCurrentRange = curQuarter;
                selectedPreviousRange = prevQuarter;
            }
        } else if (periodType === 'year') {
            if (customYear) {
                const dummyDate = makeICTDate(Number(customYear), 6, 15);
                selectedCurrentRange = getYearRange(dummyDate, 0);
                selectedPreviousRange = getYearRange(dummyDate, -1);
            } else {
                selectedCurrentRange = curYear;
                selectedPreviousRange = prevYear;
            }
        } else if (periodType === 'custom' && customStart && customEnd) {
            const sDate = new Date(customStart);
            sDate.setHours(0, 0, 0, 0);
            const eDate = new Date(customEnd);
            eDate.setHours(23, 59, 59, 999);
            const duration = eDate.getTime() - sDate.getTime();
            const prevSDate = new Date(sDate.getTime() - duration - 1);
            const prevEDate = new Date(sDate.getTime() - 1);

            selectedCurrentRange = { startDate: sDate, endDate: eDate, label: "Tùy chỉnh", type: "custom" };
            selectedPreviousRange = { startDate: prevSDate, endDate: prevEDate, label: "Kỳ trước đó", type: "custom" };
        } else {
            if (customMonth && customYear) {
                const dummyDate = makeICTDate(Number(customYear), Number(customMonth) - 1, 15);
                selectedCurrentRange = getMonthRange(dummyDate, 0);
                selectedPreviousRange = getMonthRange(dummyDate, -1);
            } else {
                selectedCurrentRange = curMonth;
                selectedPreviousRange = prevMonth;
            }
        }

        const [selectedCurrentStats, selectedPreviousStats] = await Promise.all([
            computeMetricsForRange(selectedCurrentRange.startDate, selectedCurrentRange.endDate),
            computeMetricsForRange(selectedPreviousRange.startDate, selectedPreviousRange.endDate)
        ]);

        const selectedComparison = buildComparison(selectedCurrentStats, selectedPreviousStats);

        const [timelineChart, topSales, topCustomers] = await Promise.all([
            generateTimelineChartData(selectedCurrentRange.type, selectedCurrentRange.startDate, selectedCurrentRange.endDate, selectedCurrentRange.startDate),
            getTopPerformers(selectedCurrentRange.startDate, selectedCurrentRange.endDate),
            getTopCustomers(selectedCurrentRange.startDate, selectedCurrentRange.endDate)
        ]);

        const recentContracts = await HopDong.find({
            maHopDong: { $ne: "CH-CHUNG" },
            ngayHopDong: { $gte: selectedCurrentRange.startDate, $lte: selectedCurrentRange.endDate }
        })
        .populate("khachHang1", "tenKhachHang soDienThoai")
        .sort({ ngayHopDong: -1 })
        .limit(10)
        .lean();

        const recentExpenses = await ChiTieu.find({
            date: { $gte: selectedCurrentRange.startDate, $lte: selectedCurrentRange.endDate }
        })
        .sort({ date: -1 })
        .limit(10)
        .lean();

        const allPendingContracts = await HopDong.aggregate([
            { $match: { maHopDong: { $ne: "CH-CHUNG" }, "thanhToan.conLai": { $gt: 0 } } },
            { $group: { _id: null, totalReceivable: { $sum: "$thanhToan.conLai" }, count: { $sum: 1 } } }
        ]);
        const systemTotalReceivable = allPendingContracts[0]?.totalReceivable || 0;
        const systemTotalPendingContracts = allPendingContracts[0]?.count || 0;

        return success(res, "Lấy báo cáo kinh doanh thành công", {
            periodType,
            selectedPeriod: {
                currentRange: selectedCurrentRange,
                previousRange: selectedPreviousRange,
                current: selectedCurrentStats,
                previous: selectedPreviousStats,
                comparison: selectedComparison,
                timelineChart,
                topSales,
                topCustomers,
                recentContracts,
                recentExpenses
            },
            overview,
            systemStats: {
                systemTotalReceivable,
                systemTotalPendingContracts
            }
        });
    } catch (err) {
        console.error("Lỗi lấy báo cáo kinh doanh:", err);
        return error(res, "Lỗi lấy báo cáo kinh doanh: " + err.message);
    }
}

module.exports = {
    getBaoCaoKinhDoanh,
    computeMetricsForRange,
    getWeekRange,
    getMonthRange,
    getQuarterRange,
    getYearRange
};
