const HopDong = require("../models/hopDong.model");
const ChiTieu = require("../models/chiTieu.model");
const Payment = require("../models/payment.model");
const KhachHang = require("../models/khachHang.model");
const User = require("../models/user.model");
const { success, error } = require("../utils/response");
const { getICTComponents, makeICTDate } = require("../utils/dateUtils");

function getDayRange(refDate = new Date(), offset = 0) {
    const ict = getICTComponents(refDate);
    const targetDate = ict.date + offset;

    const startDate = makeICTDate(ict.year, ict.month, targetDate, 0, 0, 0, 0);
    const endDate = makeICTDate(ict.year, ict.month, targetDate, 23, 59, 59, 999);

    const startIct = getICTComponents(startDate);
    const label = offset === 0 ? `Hôm nay (${startIct.date}/${startIct.month + 1}/${startIct.year})` :
                 offset === -1 ? `Hôm qua (${startIct.date}/${startIct.month + 1}/${startIct.year})` :
                 `Ngày ${startIct.date}/${startIct.month + 1}/${startIct.year}`;

    return { startDate, endDate, label, type: 'day', day: startIct.date, month: startIct.month + 1, year: startIct.year };
}

function parsePeriodRange(params = {}) {
    const {
        periodType = 'month',
        date: customDate,
        month: customMonth,
        quarter: customQuarter,
        year: customYear,
        startDate: customStart,
        endDate: customEnd
    } = params;

    const now = new Date();
    let currentRange, previousRange;
    const normalizedPeriod = (periodType || 'month').toLowerCase();

    if (normalizedPeriod === 'day' || normalizedPeriod === 'ngay' || normalizedPeriod === 'date') {
        let refDate = now;
        if (customDate) {
            const parts = String(customDate).split('T')[0].split('-');
            if (parts.length === 3) {
                refDate = makeICTDate(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
            } else {
                const parsed = new Date(customDate);
                if (!isNaN(parsed.getTime())) refDate = parsed;
            }
        }
        currentRange = getDayRange(refDate, 0);
        previousRange = getDayRange(refDate, -1);
    } else if (normalizedPeriod === 'week' || normalizedPeriod === 'tuan') {
        let refDate = now;
        if (customDate) {
            const parts = String(customDate).split('T')[0].split('-');
            if (parts.length === 3) {
                refDate = makeICTDate(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
            } else {
                const parsed = new Date(customDate);
                if (!isNaN(parsed.getTime())) refDate = parsed;
            }
        }
        currentRange = getWeekRange(refDate, 0);
        previousRange = getWeekRange(refDate, -1);
    } else if (normalizedPeriod === 'quarter' || normalizedPeriod === 'quy') {
        if (customQuarter && customYear) {
            const dummyDate = makeICTDate(Number(customYear), (Number(customQuarter) - 1) * 3, 15);
            currentRange = getQuarterRange(dummyDate, 0);
            previousRange = getQuarterRange(dummyDate, -1);
        } else {
            currentRange = getQuarterRange(now, 0);
            previousRange = getQuarterRange(now, -1);
        }
    } else if (normalizedPeriod === 'year' || normalizedPeriod === 'nam') {
        if (customYear) {
            const dummyDate = makeICTDate(Number(customYear), 6, 15);
            currentRange = getYearRange(dummyDate, 0);
            previousRange = getYearRange(dummyDate, -1);
        } else {
            currentRange = getYearRange(now, 0);
            previousRange = getYearRange(now, -1);
        }
    } else if (normalizedPeriod === 'custom' && customStart && customEnd) {
        const sDate = new Date(customStart);
        sDate.setHours(0, 0, 0, 0);
        const eDate = new Date(customEnd);
        eDate.setHours(23, 59, 59, 999);
        const duration = eDate.getTime() - sDate.getTime();
        const prevSDate = new Date(sDate.getTime() - duration - 1);
        const prevEDate = new Date(sDate.getTime() - 1);

        currentRange = { startDate: sDate, endDate: eDate, label: "Tùy chỉnh", type: "custom" };
        previousRange = { startDate: prevSDate, endDate: prevEDate, label: "Kỳ trước đó", type: "custom" };
    } else if (normalizedPeriod === 'all' || normalizedPeriod === 'tat_ca') {
        currentRange = { startDate: new Date(0), endDate: new Date(8640000000000000), label: "Toàn bộ thời gian", type: "all" };
        previousRange = null;
    } else {
        if (customMonth && customYear) {
            const dummyDate = makeICTDate(Number(customYear), Number(customMonth) - 1, 15);
            currentRange = getMonthRange(dummyDate, 0);
            previousRange = getMonthRange(dummyDate, -1);
        } else {
            currentRange = getMonthRange(now, 0);
            previousRange = getMonthRange(now, -1);
        }
    }

    return { currentRange, previousRange, periodType: normalizedPeriod };
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
// =========================================================================
// SCHEDULE EXTRACTION HELPERS FOR PERIOD REPORTING
// =========================================================================

const SCHEDULE_DATE_KEYS = [
    { key: 'ngayChup', label: 'Chụp hình', icon: '📸' },
    { key: 'ngayAnHoi', label: 'Ăn hỏi', icon: '💍' },
    { key: 'ngayCuoi', label: 'Ngày cưới', icon: '👰' },
    { key: 'ngayChinhAnh', label: 'Chỉnh ảnh', icon: '🎨' },
    { key: 'ngayTraAnh', label: 'Trả ảnh', icon: '🖼️' },
    { key: 'ngayChuyenInAnh', label: 'Chuyển in', icon: '🖨️' },
    { key: 'ngayMuonDo', label: 'Mượn đồ', icon: '👗' },
    { key: 'ngayTraDo', label: 'Trả đồ', icon: '👔' }
];

function buildScheduleQuery(startDate, endDate) {
    return [
        { "cacNgay.ngayChup": { $gte: startDate, $lte: endDate } },
        { "cacNgay.ngayAnHoi": { $gte: startDate, $lte: endDate } },
        { "cacNgay.ngayCuoi": { $gte: startDate, $lte: endDate } },
        { "cacNgay.ngayChinhAnh": { $gte: startDate, $lte: endDate } },
        { "cacNgay.ngayTraAnh": { $gte: startDate, $lte: endDate } },
        { "cacNgay.ngayChuyenInAnh": { $gte: startDate, $lte: endDate } },
        { "cacNgay.ngayMuonDo": { $gte: startDate, $lte: endDate } },
        { "cacNgay.ngayTraDo": { $gte: startDate, $lte: endDate } }
    ];
}

function extractMatchedSchedules(hd, startDate, endDate) {
    const sTime = new Date(startDate).getTime();
    const eTime = new Date(endDate).getTime();
    const matched = [];

    if (hd.cacNgay) {
        for (const item of SCHEDULE_DATE_KEYS) {
            const val = hd.cacNgay[item.key];
            if (val) {
                const d = new Date(val);
                const t = d.getTime();
                if (!isNaN(t) && t >= sTime && t <= eTime) {
                    matched.push({
                        type: item.key,
                        label: item.label,
                        icon: item.icon,
                        date: d
                    });
                }
            }
        }
    }
    return matched;
}

// =========================================================================
// CORE STATS COMPUTATION FOR A DATE RANGE
// =========================================================================

async function computeMetricsForRange(startDate, endDate) {
    // 1. Fetch contracts signed in range (Ký trong kỳ)
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

    // 2. Fetch contracts having schedule in range (Doanh số theo lịch trong kỳ)
    const scheduleConditions = buildScheduleQuery(startDate, endDate);
    const scheduledContracts = await HopDong.find({
        maHopDong: { $ne: "CH-CHUNG" },
        $or: scheduleConditions
    }).select("maHopDong ngayHopDong thanhToan cacNgay soanDo nguoiPhucVu giaiDoan dichVuChinh").lean();

    const soLuongHopDongTheoLich = scheduledContracts.length;
    let tongDoanhSoTheoLich = 0;
    let daThuTheoLich = 0;
    let conNoTheoLich = 0;

    scheduledContracts.forEach(hd => {
        const val = Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
        const paid = Number(hd.thanhToan?.khachHangDaThanhToan ?? 0);
        const debt = Number(hd.thanhToan?.conLai ?? Math.max(0, val - paid));

        tongDoanhSoTheoLich += val;
        daThuTheoLich += paid;
        conNoTheoLich += debt;
    });

    const tyLeThuHoiTheoLich = tongDoanhSoTheoLich > 0 ? Number(((daThuTheoLich / tongDoanhSoTheoLich) * 100).toFixed(1)) : 0;

    // 3. Fetch expenses in range
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
        soLuongHopDongTheoLich,
        tongDoanhSoTheoLich,
        daThuTheoLich,
        conNoTheoLich,
        tyLeThuHoiTheoLich,
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
        soLuongHopDongTheoLich: {
            current: current.soLuongHopDongTheoLich || 0,
            previous: previous.soLuongHopDongTheoLich || 0,
            diff: (current.soLuongHopDongTheoLich || 0) - (previous.soLuongHopDongTheoLich || 0),
            growthPercent: calcGrowth(current.soLuongHopDongTheoLich, previous.soLuongHopDongTheoLich),
            trend: getTrend(current.soLuongHopDongTheoLich, previous.soLuongHopDongTheoLich)
        },
        tongDoanhSoTheoLich: {
            current: current.tongDoanhSoTheoLich || 0,
            previous: previous.tongDoanhSoTheoLich || 0,
            diff: (current.tongDoanhSoTheoLich || 0) - (previous.tongDoanhSoTheoLich || 0),
            growthPercent: calcGrowth(current.tongDoanhSoTheoLich, previous.tongDoanhSoTheoLich),
            trend: getTrend(current.tongDoanhSoTheoLich, previous.tongDoanhSoTheoLich)
        },
        daThuTheoLich: {
            current: current.daThuTheoLich || 0,
            previous: previous.daThuTheoLich || 0,
            diff: (current.daThuTheoLich || 0) - (previous.daThuTheoLich || 0),
            growthPercent: calcGrowth(current.daThuTheoLich, previous.daThuTheoLich),
            trend: getTrend(current.daThuTheoLich, previous.daThuTheoLich)
        },
        conNoTheoLich: {
            current: current.conNoTheoLich || 0,
            previous: previous.conNoTheoLich || 0,
            diff: (current.conNoTheoLich || 0) - (previous.conNoTheoLich || 0),
            growthPercent: calcGrowth(current.conNoTheoLich, previous.conNoTheoLich),
            trend: getTrend(current.conNoTheoLich, previous.conNoTheoLich)
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

        // 3. Fetch full list of contracts with schedules in the selected period
        const scheduleConditions = buildScheduleQuery(selectedCurrentRange.startDate, selectedCurrentRange.endDate);
        const scheduledContractsRaw = await HopDong.find({
            maHopDong: { $ne: "CH-CHUNG" },
            $or: scheduleConditions
        })
        .populate("khachHang1", "tenKhachHang soDienThoai diaChi")
        .populate("khachHang2", "tenKhachHang soDienThoai diaChi")
        .populate("gioHang.dichVu", "tenDichVu")
        .lean();

        const scheduledContracts = scheduledContractsRaw.map(hd => {
            const matchedSchedules = extractMatchedSchedules(hd, selectedCurrentRange.startDate, selectedCurrentRange.endDate);
            return {
                ...hd,
                matchedSchedules
            };
        });

        // Sắp xếp theo ngày lịch đầu tiên trong kỳ
        scheduledContracts.sort((a, b) => {
            const dateA = a.matchedSchedules?.[0]?.date ? new Date(a.matchedSchedules[0].date).getTime() : 0;
            const dateB = b.matchedSchedules?.[0]?.date ? new Date(b.matchedSchedules[0].date).getTime() : 0;
            return dateA - dateB;
        });

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
                scheduledContracts,
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

// =========================================================================
// CUSTOMER PAYMENT HISTORY (LỊCH SỬ KHÁCH HÀNG THANH TOÁN)
// =========================================================================

async function getAllCustomerPayments() {
    // 1. Fetch contracts that have payments or payment history
    const contracts = await HopDong.find({
        maHopDong: { $ne: "CH-CHUNG" },
        $or: [
            { "thanhToan.cacLuotThanhToan.0": { $exists: true } },
            { "thanhToan.khachHangDaThanhToan": { $gt: 0 } }
        ]
    })
    .populate("khachHang1", "tenKhachHang soDienThoai diaChi avatar facebookId")
    .populate("khachHang2", "tenKhachHang soDienThoai diaChi avatar")
    .select("maHopDong ngayHopDong createdAt thanhToan khachHang1 khachHang2")
    .lean();

    const paymentList = [];
    const seenPaymentIds = new Set();

    contracts.forEach(hd => {
        const paidItems = hd.thanhToan?.cacLuotThanhToan || [];
        if (paidItems.length > 0) {
            paidItems.forEach((p, idx) => {
                const pId = p.id || `TT-${hd.maHopDong}-${idx}`;
                seenPaymentIds.add(pId);

                const pDate = p.date ? new Date(p.date) : (hd.ngayHopDong ? new Date(hd.ngayHopDong) : new Date(hd.createdAt || Date.now()));

                paymentList.push({
                    id: pId,
                    paymentId: p.id || pId,
                    date: pDate,
                    amount: Number(p.amount) || 0,
                    method: p.method || "Tiền mặt",
                    noiDung: p.noiDung || `Thanh toán hợp đồng ${hd.maHopDong}`,
                    maHopDong: hd.maHopDong,
                    hopDongId: hd._id,
                    ngayHopDong: hd.ngayHopDong,
                    khachHang: {
                        _id: hd.khachHang1?._id || null,
                        tenKhachHang: hd.khachHang1?.tenKhachHang || p.khachHang || "Khách hàng",
                        soDienThoai: hd.khachHang1?.soDienThoai || "-",
                        diaChi: hd.khachHang1?.diaChi || "-",
                        avatar: hd.khachHang1?.avatar || "",
                        facebookId: hd.khachHang1?.facebookId || ""
                    },
                    khachHang2: hd.khachHang2 ? {
                        _id: hd.khachHang2._id,
                        tenKhachHang: hd.khachHang2.tenKhachHang,
                        soDienThoai: hd.khachHang2.soDienThoai
                    } : null,
                    hopDongThanhToan: {
                        tongGiaTri: Number(hd.thanhToan?.tongGiaTri ?? 0),
                        tongGiaTriSauGiam: Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0),
                        khachHangDaThanhToan: Number(hd.thanhToan?.khachHangDaThanhToan ?? 0),
                        conLai: Number(hd.thanhToan?.conLai ?? 0),
                        trangThaiThanhToan: hd.thanhToan?.trangThaiThanhToan || "Chưa thanh toán",
                        phanTramDaThanhToan: Number(hd.thanhToan?.phanTramDaThanhToan ?? 0)
                    },
                    createdAt: p.createdAt || pDate
                });
            });
        } else if (Number(hd.thanhToan?.khachHangDaThanhToan || 0) > 0) {
            // Trường hợp dữ liệu cũ: Đã có tiền thanh toán nhưng mảng cacLuotThanhToan trống
            const pId = `TT-${hd.maHopDong}-LEGACY`;
            seenPaymentIds.add(pId);
            const pDate = hd.ngayHopDong ? new Date(hd.ngayHopDong) : new Date(hd.createdAt || Date.now());

            paymentList.push({
                id: pId,
                paymentId: pId,
                date: pDate,
                amount: Number(hd.thanhToan.khachHangDaThanhToan),
                method: "Tiền mặt",
                noiDung: `Thanh toán hợp đồng ${hd.maHopDong}`,
                maHopDong: hd.maHopDong,
                hopDongId: hd._id,
                ngayHopDong: hd.ngayHopDong,
                khachHang: {
                    _id: hd.khachHang1?._id || null,
                    tenKhachHang: hd.khachHang1?.tenKhachHang || "Khách hàng",
                    soDienThoai: hd.khachHang1?.soDienThoai || "-",
                    diaChi: hd.khachHang1?.diaChi || "-",
                    avatar: hd.khachHang1?.avatar || "",
                    facebookId: hd.khachHang1?.facebookId || ""
                },
                khachHang2: hd.khachHang2 ? {
                    _id: hd.khachHang2._id,
                    tenKhachHang: hd.khachHang2.tenKhachHang,
                    soDienThoai: hd.khachHang2.soDienThoai
                } : null,
                hopDongThanhToan: {
                    tongGiaTri: Number(hd.thanhToan?.tongGiaTri ?? 0),
                    tongGiaTriSauGiam: Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0),
                    khachHangDaThanhToan: Number(hd.thanhToan?.khachHangDaThanhToan ?? 0),
                    conLai: Number(hd.thanhToan?.conLai ?? 0),
                    trangThaiThanhToan: hd.thanhToan?.trangThaiThanhToan || "Chưa thanh toán",
                    phanTramDaThanhToan: Number(hd.thanhToan?.phanTramDaThanhToan ?? 0)
                },
                createdAt: pDate
            });
        }
    });

    // 2. Fetch standalone Payment collection records (e.g. từ SePay webhook hoặc thanh toán ngoài)
    const standalonePayments = await Payment.find().lean();
    if (standalonePayments && standalonePayments.length > 0) {
        for (const sp of standalonePayments) {
            if (sp.id && !seenPaymentIds.has(sp.id)) {
                seenPaymentIds.add(sp.id);

                let linkedContractCode = sp.maHopDong || "";
                if (!linkedContractCode && sp.noiDung) {
                    const match = sp.noiDung.match(/HD[A-Z0-9_\-]+/i);
                    if (match) linkedContractCode = match[0];
                }

                paymentList.push({
                    id: sp.id,
                    paymentId: sp.id,
                    date: sp.date ? new Date(sp.date) : new Date(sp.createdAt || Date.now()),
                    amount: Number(sp.amount) || 0,
                    method: sp.method || "Chuyển khoản",
                    noiDung: sp.noiDung || "Thanh toán",
                    maHopDong: linkedContractCode || "-",
                    hopDongId: sp.hopDongId || null,
                    ngayHopDong: null,
                    khachHang: {
                        _id: sp.khachHangId || null,
                        tenKhachHang: sp.khachHang || "Khách hàng",
                        soDienThoai: "-",
                        diaChi: "-",
                        avatar: "",
                        facebookId: ""
                    },
                    khachHang2: null,
                    hopDongThanhToan: {
                        tongGiaTri: Number(sp.amount) || 0,
                        tongGiaTriSauGiam: Number(sp.amount) || 0,
                        khachHangDaThanhToan: Number(sp.amount) || 0,
                        conLai: 0,
                        trangThaiThanhToan: "Đã thanh toán đủ",
                        phanTramDaThanhToan: 100
                    },
                    createdAt: sp.createdAt || sp.date
                });
            }
        }
    }

    return paymentList;
}

async function getLichSuThanhToan(req, res) {
    try {
        const params = { ...(req.query || {}), ...(req.body || {}) };
        const {
            periodType = 'month',
            keyword,
            method,
            trangThaiThanhToan,
            minAmount,
            maxAmount,
            khachHangId,
            page = 1,
            limit = 20,
            sortBy = 'date',
            sortOrder = 'desc'
        } = params;

        // 1. Xác định khoảng thời gian lọc
        let range;
        const normalizedPeriod = (periodType || 'month').toLowerCase();
        if (normalizedPeriod === 'all' || normalizedPeriod === 'tat_ca') {
            range = { startDate: new Date(0), endDate: new Date(8640000000000000), label: "Toàn bộ thời gian", type: "all" };
        } else {
            const parsed = parsePeriodRange(params);
            range = parsed.currentRange;
        }

        const allPayments = await getAllCustomerPayments();

        // 2. Lọc các bản ghi
        const sTime = new Date(range.startDate).getTime();
        const eTime = new Date(range.endDate).getTime();

        const kwLower = (keyword || '').trim().toLowerCase();
        const methodLower = (method || '').trim().toLowerCase();
        const statusLower = (trangThaiThanhToan || '').trim().toLowerCase();

        const filtered = allPayments.filter(item => {
            // Lọc thời gian giao dịch
            const pTime = new Date(item.date).getTime();
            if (pTime < sTime || pTime > eTime) return false;

            // Lọc theo ID khách hàng cụ thể
            if (khachHangId && item.khachHang?._id?.toString() !== khachHangId.toString()) {
                return false;
            }

            // Lọc từ khóa tìm kiếm (Tên KH, SĐT, Mã HĐ, Mã thanh toán, Nội dung)
            if (kwLower) {
                const matchName = (item.khachHang?.tenKhachHang || '').toLowerCase().includes(kwLower);
                const matchPhone = (item.khachHang?.soDienThoai || '').toLowerCase().includes(kwLower);
                const matchContract = (item.maHopDong || '').toLowerCase().includes(kwLower);
                const matchId = (item.id || '').toLowerCase().includes(kwLower);
                const matchContent = (item.noiDung || '').toLowerCase().includes(kwLower);
                if (!matchName && !matchPhone && !matchContract && !matchId && !matchContent) {
                    return false;
                }
            }

            // Lọc phương thức thanh toán
            if (methodLower && !(item.method || '').toLowerCase().includes(methodLower)) {
                return false;
            }

            // Lọc trạng thái thanh toán hợp đồng
            if (statusLower && !(item.hopDongThanhToan?.trangThaiThanhToan || '').toLowerCase().includes(statusLower)) {
                return false;
            }

            // Lọc khoảng số tiền
            if (minAmount !== undefined && minAmount !== '' && item.amount < Number(minAmount)) {
                return false;
            }
            if (maxAmount !== undefined && maxAmount !== '' && item.amount > Number(maxAmount)) {
                return false;
            }

            return true;
        });

        // 3. Tính toán các chỉ số tổng hợp
        let tongTienThanhToan = 0;
        const uniqueCustomerSet = new Set();
        const methodSummaryMap = {};
        const statusSummaryMap = {};
        const dailySummaryMap = {};

        filtered.forEach(p => {
            tongTienThanhToan += p.amount;

            // Khách hàng duy nhất
            const custKey = p.khachHang?._id?.toString() || p.khachHang?.soDienThoai || p.khachHang?.tenKhachHang;
            if (custKey) uniqueCustomerSet.add(custKey);

            // Theo phương thức thanh toán
            const mKey = p.method || "Khác";
            if (!methodSummaryMap[mKey]) {
                methodSummaryMap[mKey] = { method: mKey, count: 0, totalAmount: 0 };
            }
            methodSummaryMap[mKey].count += 1;
            methodSummaryMap[mKey].totalAmount += p.amount;

            // Theo trạng thái hợp đồng
            const sKey = p.hopDongThanhToan?.trangThaiThanhToan || "Chưa xác định";
            if (!statusSummaryMap[sKey]) {
                statusSummaryMap[sKey] = { status: sKey, count: 0, totalAmount: 0 };
            }
            statusSummaryMap[sKey].count += 1;
            statusSummaryMap[sKey].totalAmount += p.amount;

            // Biểu đồ theo ngày trong kỳ lọc
            const ict = getICTComponents(new Date(p.date));
            const dayKey = `${ict.year}-${String(ict.month + 1).padStart(2, '0')}-${String(ict.date).padStart(2, '0')}`;
            if (!dailySummaryMap[dayKey]) {
                dailySummaryMap[dayKey] = {
                    dateKey: dayKey,
                    label: `${ict.date}/${ict.month + 1}`,
                    count: 0,
                    amount: 0
                };
            }
            dailySummaryMap[dayKey].count += 1;
            dailySummaryMap[dayKey].amount += p.amount;
        });

        const methodList = Object.values(methodSummaryMap).map(m => ({
            ...m,
            percentage: tongTienThanhToan > 0 ? Number(((m.totalAmount / tongTienThanhToan) * 100).toFixed(1)) : 0
        })).sort((a, b) => b.totalAmount - a.totalAmount);

        const statusList = Object.values(statusSummaryMap).sort((a, b) => b.totalAmount - a.totalAmount);

        const chartDaily = Object.values(dailySummaryMap).sort((a, b) => a.dateKey.localeCompare(b.dateKey));

        // 4. Sắp xếp danh sách
        filtered.sort((a, b) => {
            let valA, valB;
            if (sortBy === 'amount') {
                valA = a.amount;
                valB = b.amount;
            } else {
                valA = new Date(a.date).getTime();
                valB = new Date(b.date).getTime();
            }
            return sortOrder === 'asc' ? valA - valB : valB - valA;
        });

        // 5. Phân trang
        const totalItems = filtered.length;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = parseInt(limit, 10);
        let paginatedItems = filtered;
        let totalPages = 1;

        if (limitNum > 0) {
            totalPages = Math.ceil(totalItems / limitNum) || 1;
            const startIdx = (pageNum - 1) * limitNum;
            paginatedItems = filtered.slice(startIdx, startIdx + limitNum);
        }

        return success(res, "Lấy danh sách lịch sử khách hàng thanh toán thành công", {
            items: paginatedItems,
            pagination: {
                total: totalItems,
                totalPages,
                page: pageNum,
                limit: limitNum > 0 ? limitNum : totalItems
            },
            summary: {
                tongSoGiaoDich: totalItems,
                tongTienThanhToan,
                tongSoKhachHang: uniqueCustomerSet.size,
                thongKeTheoPhuongThuc: methodList,
                thongKeTheoTrangThai: statusList,
                chartDaily
            },
            filter: {
                periodType: normalizedPeriod,
                range
            }
        });
    } catch (err) {
        console.error("Lỗi lấy lịch sử thanh toán:", err);
        return error(res, "Lỗi lấy lịch sử thanh toán: " + err.message);
    }
}

// =========================================================================
// CUSTOMER STATISTICS (THỐNG KÊ KHÁCH HÀNG THEO NGÀY / TUẦN / THÁNG / NĂM)
// =========================================================================

async function computeCustomerMetricsForRange(startDate, endDate) {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    // 1. Khách hàng mới tạo trong kỳ
    const newCustomers = await KhachHang.find({
        createdAt: { $gte: sDate, $lte: eDate }
    }).select("_id tenKhachHang soDienThoai diaChi avatar createdAt").lean();
    const khachHangMoi = newCustomers.length;

    // 2. Hợp đồng ký trong kỳ
    const contractsSigned = await HopDong.find({
        maHopDong: { $ne: "CH-CHUNG" },
        ngayHopDong: { $gte: sDate, $lte: eDate }
    })
    .populate("khachHang1", "tenKhachHang soDienThoai diaChi avatar")
    .populate("khachHang2", "tenKhachHang soDienThoai diaChi avatar")
    .populate("gioHang.dichVu", "tenDichVu")
    .lean();

    const signingCustSet = new Set();
    let tongDoanhSoHopDong = 0;
    let daThuCuaHDKy = 0;
    let congNoPhatSinh = 0;

    contractsSigned.forEach(hd => {
        const custId = hd.khachHang1?._id?.toString() || hd.khachHang1?.soDienThoai || hd.maHopDong;
        signingCustSet.add(custId);

        const val = Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
        const paid = Number(hd.thanhToan?.khachHangDaThanhToan ?? 0);
        const debt = Number(hd.thanhToan?.conLai ?? Math.max(0, val - paid));

        tongDoanhSoHopDong += val;
        daThuCuaHDKy += paid;
        congNoPhatSinh += debt;
    });

    const khachHangKyHopDong = signingCustSet.size;
    const soLuongHopDongMoi = contractsSigned.length;
    const giaTriTrungBinhMoiKhach = khachHangKyHopDong > 0
        ? Math.round(tongDoanhSoHopDong / khachHangKyHopDong)
        : 0;

    // 3. Khách hàng thực tế phát sinh thanh toán trong kỳ
    const contractsWithPayments = await HopDong.find({
        maHopDong: { $ne: "CH-CHUNG" },
        "thanhToan.cacLuotThanhToan.date": { $gte: sDate, $lte: eDate }
    })
    .populate("khachHang1", "tenKhachHang soDienThoai diaChi")
    .select("maHopDong khachHang1 thanhToan.cacLuotThanhToan")
    .lean();

    const payingCustSet = new Set();
    let tongTienKhachThanhToan = 0;
    let soLuotThanhToan = 0;

    contractsWithPayments.forEach(hd => {
        const payments = hd.thanhToan?.cacLuotThanhToan || [];
        payments.forEach(p => {
            if (p.date) {
                const pDate = new Date(p.date);
                if (pDate >= sDate && pDate <= eDate) {
                    soLuotThanhToan += 1;
                    tongTienKhachThanhToan += (Number(p.amount) || 0);
                    const custKey = hd.khachHang1?._id?.toString() || p.khachHang || hd.maHopDong;
                    payingCustSet.add(custKey);
                }
            }
        });
    });

    // Bổ sung các khoản từ Payment collection nếu chưa tính
    const extraPayments = await Payment.find({
        date: { $gte: sDate, $lte: eDate }
    }).lean();

    if (extraPayments && extraPayments.length > 0) {
        extraPayments.forEach(ep => {
            const isDuplicate = contractsWithPayments.some(hd =>
                (hd.thanhToan?.cacLuotThanhToan || []).some(p => p.id === ep.id)
            );
            if (!isDuplicate) {
                soLuotThanhToan += 1;
                tongTienKhachThanhToan += (Number(ep.amount) || 0);
                payingCustSet.add(ep.khachHang || ep.id);
            }
        });
    }

    const khachHangThanhToan = payingCustSet.size;
    const tyLeThuHoi = tongDoanhSoHopDong > 0
        ? Number(((tongTienKhachThanhToan / tongDoanhSoHopDong) * 100).toFixed(1))
        : 0;

    return {
        startDate: sDate,
        endDate: eDate,
        khachHangMoi,
        khachHangKyHopDong,
        soLuongHopDongMoi,
        tongDoanhSoHopDong,
        khachHangThanhToan,
        soLuotThanhToan,
        tongTienKhachThanhToan,
        congNoPhatSinh,
        giaTriTrungBinhMoiKhach,
        tyLeThuHoi
    };
}

function buildCustomerComparison(current, previous) {
    if (!previous) return null;
    return {
        khachHangMoi: {
            current: current.khachHangMoi,
            previous: previous.khachHangMoi,
            diff: current.khachHangMoi - previous.khachHangMoi,
            growthPercent: calcGrowth(current.khachHangMoi, previous.khachHangMoi),
            trend: getTrend(current.khachHangMoi, previous.khachHangMoi)
        },
        khachHangKyHopDong: {
            current: current.khachHangKyHopDong,
            previous: previous.khachHangKyHopDong,
            diff: current.khachHangKyHopDong - previous.khachHangKyHopDong,
            growthPercent: calcGrowth(current.khachHangKyHopDong, previous.khachHangKyHopDong),
            trend: getTrend(current.khachHangKyHopDong, previous.khachHangKyHopDong)
        },
        soLuongHopDongMoi: {
            current: current.soLuongHopDongMoi,
            previous: previous.soLuongHopDongMoi,
            diff: current.soLuongHopDongMoi - previous.soLuongHopDongMoi,
            growthPercent: calcGrowth(current.soLuongHopDongMoi, previous.soLuongHopDongMoi),
            trend: getTrend(current.soLuongHopDongMoi, previous.soLuongHopDongMoi)
        },
        tongDoanhSoHopDong: {
            current: current.tongDoanhSoHopDong,
            previous: previous.tongDoanhSoHopDong,
            diff: current.tongDoanhSoHopDong - previous.tongDoanhSoHopDong,
            growthPercent: calcGrowth(current.tongDoanhSoHopDong, previous.tongDoanhSoHopDong),
            trend: getTrend(current.tongDoanhSoHopDong, previous.tongDoanhSoHopDong)
        },
        khachHangThanhToan: {
            current: current.khachHangThanhToan,
            previous: previous.khachHangThanhToan,
            diff: current.khachHangThanhToan - previous.khachHangThanhToan,
            growthPercent: calcGrowth(current.khachHangThanhToan, previous.khachHangThanhToan),
            trend: getTrend(current.khachHangThanhToan, previous.khachHangThanhToan)
        },
        tongTienKhachThanhToan: {
            current: current.tongTienKhachThanhToan,
            previous: previous.tongTienKhachThanhToan,
            diff: current.tongTienKhachThanhToan - previous.tongTienKhachThanhToan,
            growthPercent: calcGrowth(current.tongTienKhachThanhToan, previous.tongTienKhachThanhToan),
            trend: getTrend(current.tongTienKhachThanhToan, previous.tongTienKhachThanhToan)
        },
        congNoPhatSinh: {
            current: current.congNoPhatSinh,
            previous: previous.congNoPhatSinh,
            diff: current.congNoPhatSinh - previous.congNoPhatSinh,
            growthPercent: calcGrowth(current.congNoPhatSinh, previous.congNoPhatSinh),
            trend: getTrend(current.congNoPhatSinh, previous.congNoPhatSinh)
        }
    };
}

async function generateCustomerTimelineChartData(periodType, startDate, endDate, refDate = new Date()) {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    const ictRef = getICTComponents(refDate);

    // Fetch toàn bộ dữ liệu trong khoảng 1 lần duy nhất để tối ưu hiệu năng
    const [periodCustomers, periodContracts, contractsWithPayments] = await Promise.all([
        KhachHang.find({ createdAt: { $gte: sDate, $lte: eDate } }).select("_id createdAt").lean(),
        HopDong.find({
            maHopDong: { $ne: "CH-CHUNG" },
            ngayHopDong: { $gte: sDate, $lte: eDate }
        }).select("maHopDong ngayHopDong khachHang1 thanhToan").lean(),
        HopDong.find({
            maHopDong: { $ne: "CH-CHUNG" },
            "thanhToan.cacLuotThanhToan.date": { $gte: sDate, $lte: eDate }
        }).select("maHopDong thanhToan.cacLuotThanhToan khachHang1").lean()
    ]);

    const periodPayments = [];
    contractsWithPayments.forEach(hd => {
        (hd.thanhToan?.cacLuotThanhToan || []).forEach(p => {
            if (p.date) {
                const pDate = new Date(p.date);
                if (pDate >= sDate && pDate <= eDate) {
                    periodPayments.push({
                        date: pDate,
                        amount: Number(p.amount) || 0,
                        khachHang: hd.khachHang1?.toString() || p.khachHang
                    });
                }
            }
        });
    });

    const chartData = [];

    if (periodType === 'day') {
        // Phân bổ 24 khung giờ trong ngày
        for (let h = 0; h < 24; h++) {
            const hCustomers = periodCustomers.filter(c => getICTComponents(new Date(c.createdAt)).hours === h);
            const hContracts = periodContracts.filter(hd => getICTComponents(new Date(hd.ngayHopDong)).hours === h);
            const hPayments = periodPayments.filter(p => getICTComponents(new Date(p.date)).hours === h);

            const hCustSet = new Set(hContracts.map(hd => hd.khachHang1?.toString()).filter(Boolean));
            let hDoanhSo = 0;
            hContracts.forEach(hd => {
                hDoanhSo += Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
            });

            let hTienThu = 0;
            hPayments.forEach(p => {
                hTienThu += p.amount;
            });

            chartData.push({
                label: `${h}h`,
                subLabel: `${String(h).padStart(2, '0')}:00`,
                hour: h,
                khachHangMoi: hCustomers.length,
                khachHangKyHopDong: hCustSet.size,
                soLuongHopDong: hContracts.length,
                tongDoanhSo: hDoanhSo,
                tongTienThanhToan: hTienThu,
                soLuotThanhToan: hPayments.length
            });
        }
    } else if (periodType === 'week') {
        const dayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
        for (let i = 0; i < 7; i++) {
            const dStart = new Date(sDate);
            dStart.setDate(dStart.getDate() + i);
            const dIct = getICTComponents(dStart);

            const dayCustomers = periodCustomers.filter(c => {
                const cIct = getICTComponents(new Date(c.createdAt));
                return cIct.year === dIct.year && cIct.month === dIct.month && cIct.date === dIct.date;
            });
            const dayContracts = periodContracts.filter(hd => {
                const hdIct = getICTComponents(new Date(hd.ngayHopDong));
                return hdIct.year === dIct.year && hdIct.month === dIct.month && hdIct.date === dIct.date;
            });
            const dayPayments = periodPayments.filter(p => {
                const pIct = getICTComponents(new Date(p.date));
                return pIct.year === dIct.year && pIct.month === dIct.month && pIct.date === dIct.date;
            });

            const dayCustSet = new Set(dayContracts.map(hd => hd.khachHang1?.toString()).filter(Boolean));
            let dayDoanhSo = 0;
            dayContracts.forEach(hd => {
                dayDoanhSo += Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
            });

            let dayTienThu = 0;
            dayPayments.forEach(p => {
                dayTienThu += p.amount;
            });

            chartData.push({
                label: dayNames[i],
                subLabel: `${dIct.date}/${dIct.month + 1}`,
                date: dStart,
                khachHangMoi: dayCustomers.length,
                khachHangKyHopDong: dayCustSet.size,
                soLuongHopDong: dayContracts.length,
                tongDoanhSo: dayDoanhSo,
                tongTienThanhToan: dayTienThu,
                soLuotThanhToan: dayPayments.length
            });
        }
    } else if (periodType === 'month') {
        const daysInMonth = new Date(ictRef.year, ictRef.month + 1, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
            const dayCustomers = periodCustomers.filter(c => {
                const cIct = getICTComponents(new Date(c.createdAt));
                return cIct.date === d;
            });
            const dayContracts = periodContracts.filter(hd => {
                const hdIct = getICTComponents(new Date(hd.ngayHopDong));
                return hdIct.date === d;
            });
            const dayPayments = periodPayments.filter(p => {
                const pIct = getICTComponents(new Date(p.date));
                return pIct.date === d;
            });

            const dayCustSet = new Set(dayContracts.map(hd => hd.khachHang1?.toString()).filter(Boolean));
            let dayDoanhSo = 0;
            dayContracts.forEach(hd => {
                dayDoanhSo += Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
            });

            let dayTienThu = 0;
            dayPayments.forEach(p => {
                dayTienThu += p.amount;
            });

            chartData.push({
                label: `${d}`,
                subLabel: `${d}/${ictRef.month + 1}`,
                day: d,
                khachHangMoi: dayCustomers.length,
                khachHangKyHopDong: dayCustSet.size,
                soLuongHopDong: dayContracts.length,
                tongDoanhSo: dayDoanhSo,
                tongTienThanhToan: dayTienThu,
                soLuotThanhToan: dayPayments.length
            });
        }
    } else if (periodType === 'quarter') {
        const startMonth = Math.floor(ictRef.month / 3) * 3;
        for (let m = 0; m < 3; m++) {
            const mIndex = startMonth + m;
            const mCustomers = periodCustomers.filter(c => getICTComponents(new Date(c.createdAt)).month === mIndex);
            const mContracts = periodContracts.filter(hd => getICTComponents(new Date(hd.ngayHopDong)).month === mIndex);
            const mPayments = periodPayments.filter(p => getICTComponents(new Date(p.date)).month === mIndex);

            const mCustSet = new Set(mContracts.map(hd => hd.khachHang1?.toString()).filter(Boolean));
            let mDoanhSo = 0;
            mContracts.forEach(hd => {
                mDoanhSo += Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
            });

            let mTienThu = 0;
            mPayments.forEach(p => {
                mTienThu += p.amount;
            });

            chartData.push({
                label: `Tháng ${mIndex + 1}`,
                subLabel: `Th${mIndex + 1}/${ictRef.year}`,
                month: mIndex + 1,
                khachHangMoi: mCustomers.length,
                khachHangKyHopDong: mCustSet.size,
                soLuongHopDong: mContracts.length,
                tongDoanhSo: mDoanhSo,
                tongTienThanhToan: mTienThu,
                soLuotThanhToan: mPayments.length
            });
        }
    } else if (periodType === 'year') {
        for (let m = 0; m < 12; m++) {
            const mCustomers = periodCustomers.filter(c => getICTComponents(new Date(c.createdAt)).month === m);
            const mContracts = periodContracts.filter(hd => getICTComponents(new Date(hd.ngayHopDong)).month === m);
            const mPayments = periodPayments.filter(p => getICTComponents(new Date(p.date)).month === m);

            const mCustSet = new Set(mContracts.map(hd => hd.khachHang1?.toString()).filter(Boolean));
            let mDoanhSo = 0;
            mContracts.forEach(hd => {
                mDoanhSo += Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);
            });

            let mTienThu = 0;
            mPayments.forEach(p => {
                mTienThu += p.amount;
            });

            chartData.push({
                label: `Th${m + 1}`,
                subLabel: `Tháng ${m + 1}`,
                month: m + 1,
                khachHangMoi: mCustomers.length,
                khachHangKyHopDong: mCustSet.size,
                soLuongHopDong: mContracts.length,
                tongDoanhSo: mDoanhSo,
                tongTienThanhToan: mTienThu,
                soLuotThanhToan: mPayments.length
            });
        }
    }

    return chartData;
}

async function getCustomerSegmentation(startDate, endDate) {
    const sDate = new Date(startDate);
    const eDate = new Date(endDate);

    const contractsInPeriod = await HopDong.find({
        maHopDong: { $ne: "CH-CHUNG" },
        ngayHopDong: { $gte: sDate, $lte: eDate }
    })
    .populate("khachHang1", "tenKhachHang soDienThoai diaChi")
    .lean();

    // 1. Phân loại Khách Mới vs Khách Quay Lại
    const customerContractMap = new Map();
    contractsInPeriod.forEach(hd => {
        const custId = hd.khachHang1?._id?.toString();
        if (custId) {
            if (!customerContractMap.has(custId)) {
                customerContractMap.set(custId, []);
            }
            customerContractMap.get(custId).push(hd);
        }
    });

    const custIds = Array.from(customerContractMap.keys());
    const priorContracts = await HopDong.find({
        maHopDong: { $ne: "CH-CHUNG" },
        khachHang1: { $in: custIds },
        ngayHopDong: { $lt: sDate }
    }).select("khachHang1").lean();

    const priorCustIdSet = new Set(priorContracts.map(hd => hd.khachHang1?.toString()));

    let soLuongKhachMoi = 0;
    let doanhSoKhachMoi = 0;
    let soLuongKhachQuayLai = 0;
    let doanhSoKhachQuayLai = 0;

    customerContractMap.forEach((hdList, custId) => {
        const totalSpent = hdList.reduce((acc, hd) => acc + Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0), 0);
        if (priorCustIdSet.has(custId)) {
            soLuongKhachQuayLai += 1;
            doanhSoKhachQuayLai += totalSpent;
        } else {
            soLuongKhachMoi += 1;
            doanhSoKhachMoi += totalSpent;
        }
    });

    // 2. Phân khúc mức chi tiêu
    const spendingTiers = [
        { label: "Dưới 10 triệu", min: 0, max: 10000000, count: 0, totalAmount: 0 },
        { label: "10 - 20 triệu", min: 10000000, max: 20000000, count: 0, totalAmount: 0 },
        { label: "20 - 50 triệu", min: 20000000, max: 50000000, count: 0, totalAmount: 0 },
        { label: "Trên 50 triệu", min: 50000000, max: Infinity, count: 0, totalAmount: 0 }
    ];

    customerContractMap.forEach((hdList) => {
        const totalSpent = hdList.reduce((acc, hd) => acc + Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0), 0);
        for (const tier of spendingTiers) {
            if (totalSpent >= tier.min && (tier.max === Infinity ? true : totalSpent < tier.max)) {
                tier.count += 1;
                tier.totalAmount += totalSpent;
                break;
            }
        }
    });

    // 3. Phân loại trạng thái thanh toán của các hợp đồng trong kỳ
    let daThanhToanDuCount = 0;
    let dangThanhToanCount = 0;
    let chuaThanhToanCount = 0;

    contractsInPeriod.forEach(hd => {
        const paid = Number(hd.thanhToan?.khachHangDaThanhToan ?? 0);
        const debt = Number(hd.thanhToan?.conLai ?? 0);
        const total = Number(hd.thanhToan?.tongGiaTriSauGiam ?? hd.thanhToan?.tongGiaTri ?? 0);

        if (debt <= 0 && (paid > 0 || total === 0)) {
            daThanhToanDuCount += 1;
        } else if (paid > 0) {
            dangThanhToanCount += 1;
        } else {
            chuaThanhToanCount += 1;
        }
    });

    // 4. Phân bổ theo địa chỉ / tỉnh thành
    const locationMap = {};
    contractsInPeriod.forEach(hd => {
        let addr = (hd.khachHang1?.diaChi || "").trim();
        if (addr && addr !== "Địa chỉ chưa cập nhật" && addr !== "-") {
            const parts = addr.split(",");
            const city = parts[parts.length - 1].trim();
            if (city) {
                locationMap[city] = (locationMap[city] || 0) + 1;
            }
        }
    });

    const topLocations = Object.entries(locationMap)
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return {
        customerTypes: {
            khachMoi: { count: soLuongKhachMoi, totalRevenue: doanhSoKhachMoi },
            khachQuayLai: { count: soLuongKhachQuayLai, totalRevenue: doanhSoKhachQuayLai }
        },
        spendingTiers,
        paymentStatus: {
            daThanhToanDu: daThanhToanDuCount,
            dangThanhToan: dangThanhToanCount,
            chuaThanhToan: chuaThanhToanCount,
            totalContracts: contractsInPeriod.length
        },
        topLocations
    };
}

async function getThongKeKhachHang(req, res) {
    try {
        const params = { ...(req.query || {}), ...(req.body || {}) };
        const { periodType = 'month' } = params;
        const now = new Date();

        // 1. Tính toán tổng quan 4 chu kỳ (Ngày, Tuần, Tháng, Năm)
        const curDay = getDayRange(now, 0);
        const prevDay = getDayRange(now, -1);
        const curWeek = getWeekRange(now, 0);
        const prevWeek = getWeekRange(now, -1);
        const curMonth = getMonthRange(now, 0);
        const prevMonth = getMonthRange(now, -1);
        const curYear = getYearRange(now, 0);
        const prevYear = getYearRange(now, -1);

        const [
            statsCurDay, statsPrevDay,
            statsCurWeek, statsPrevWeek,
            statsCurMonth, statsPrevMonth,
            statsCurYear, statsPrevYear
        ] = await Promise.all([
            computeCustomerMetricsForRange(curDay.startDate, curDay.endDate),
            computeCustomerMetricsForRange(prevDay.startDate, prevDay.endDate),
            computeCustomerMetricsForRange(curWeek.startDate, curWeek.endDate),
            computeCustomerMetricsForRange(prevWeek.startDate, prevWeek.endDate),
            computeCustomerMetricsForRange(curMonth.startDate, curMonth.endDate),
            computeCustomerMetricsForRange(prevMonth.startDate, prevMonth.endDate),
            computeCustomerMetricsForRange(curYear.startDate, curYear.endDate),
            computeCustomerMetricsForRange(prevYear.startDate, prevYear.endDate)
        ]);

        const overview = {
            day: {
                currentRange: curDay,
                previousRange: prevDay,
                current: statsCurDay,
                previous: statsPrevDay,
                comparison: buildCustomerComparison(statsCurDay, statsPrevDay)
            },
            week: {
                currentRange: curWeek,
                previousRange: prevWeek,
                current: statsCurWeek,
                previous: statsPrevWeek,
                comparison: buildCustomerComparison(statsCurWeek, statsPrevWeek)
            },
            month: {
                currentRange: curMonth,
                previousRange: prevMonth,
                current: statsCurMonth,
                previous: statsPrevMonth,
                comparison: buildCustomerComparison(statsCurMonth, statsPrevMonth)
            },
            year: {
                currentRange: curYear,
                previousRange: prevYear,
                current: statsCurYear,
                previous: statsPrevYear,
                comparison: buildCustomerComparison(statsCurYear, statsPrevYear)
            }
        };

        // 2. Tính toán chi tiết cho chu kỳ được chọn
        const parsed = parsePeriodRange(params);
        const selectedCurrentRange = parsed.currentRange;
        const selectedPreviousRange = parsed.previousRange;

        const [selectedCurrentStats, selectedPreviousStats] = await Promise.all([
            computeCustomerMetricsForRange(selectedCurrentRange.startDate, selectedCurrentRange.endDate),
            selectedPreviousRange
                ? computeCustomerMetricsForRange(selectedPreviousRange.startDate, selectedPreviousRange.endDate)
                : Promise.resolve(null)
        ]);

        const selectedComparison = buildCustomerComparison(selectedCurrentStats, selectedPreviousStats);

        const [timelineChart, segmentation, topCustomers, recentCustomers] = await Promise.all([
            generateCustomerTimelineChartData(selectedCurrentRange.type, selectedCurrentRange.startDate, selectedCurrentRange.endDate, selectedCurrentRange.startDate),
            getCustomerSegmentation(selectedCurrentRange.startDate, selectedCurrentRange.endDate),
            getTopCustomers(selectedCurrentRange.startDate, selectedCurrentRange.endDate),
            KhachHang.find({
                createdAt: { $gte: selectedCurrentRange.startDate, $lte: selectedCurrentRange.endDate }
            }).sort({ createdAt: -1 }).limit(10).lean()
        ]);

        // Danh sách giao dịch thanh toán gần nhất trong chu kỳ
        const recentPaymentsContracts = await HopDong.find({
            maHopDong: { $ne: "CH-CHUNG" },
            "thanhToan.cacLuotThanhToan.date": { $gte: selectedCurrentRange.startDate, $lte: selectedCurrentRange.endDate }
        })
        .populate("khachHang1", "tenKhachHang soDienThoai")
        .select("maHopDong thanhToan.cacLuotThanhToan khachHang1")
        .lean();

        const recentPaymentsList = [];
        recentPaymentsContracts.forEach(hd => {
            (hd.thanhToan?.cacLuotThanhToan || []).forEach(p => {
                if (p.date) {
                    const pDate = new Date(p.date);
                    if (pDate >= selectedCurrentRange.startDate && pDate <= selectedCurrentRange.endDate) {
                        recentPaymentsList.push({
                            id: p.id,
                            amount: Number(p.amount) || 0,
                            date: pDate,
                            method: p.method || "Tiền mặt",
                            noiDung: p.noiDung || "Thanh toán",
                            maHopDong: hd.maHopDong,
                            khachHang: hd.khachHang1?.tenKhachHang || p.khachHang || "Khách hàng",
                            soDienThoai: hd.khachHang1?.soDienThoai || "-"
                        });
                    }
                }
            });
        });
        recentPaymentsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const recentPayments = recentPaymentsList.slice(0, 10);

        // 3. Thống kê toàn hệ thống
        const [totalCustomersCount, totalContractsAgg] = await Promise.all([
            KhachHang.countDocuments(),
            HopDong.aggregate([
                { $match: { maHopDong: { $ne: "CH-CHUNG" } } },
                {
                    $group: {
                        _id: null,
                        totalContracts: { $sum: 1 },
                        totalRevenue: { $sum: { $ifNull: ["$thanhToan.tongGiaTriSauGiam", { $ifNull: ["$thanhToan.tongGiaTri", 0] }] } },
                        totalCollected: { $sum: { $ifNull: ["$thanhToan.khachHangDaThanhToan", 0] } },
                        totalReceivable: { $sum: { $ifNull: ["$thanhToan.conLai", 0] } }
                    }
                }
            ])
        ]);

        const aggResult = totalContractsAgg[0] || {};
        const systemStats = {
            tongKhachHangToanHeThong: totalCustomersCount,
            tongHopDongToanHeThong: aggResult.totalContracts || 0,
            tongDoanhSoToanHeThong: aggResult.totalRevenue || 0,
            tongTienDaThuToanHeThong: aggResult.totalCollected || 0,
            tongCongNoToanHeThong: aggResult.totalReceivable || 0
        };

        return success(res, "Lấy thống kê khách hàng thành công", {
            periodType: parsed.periodType,
            selectedPeriod: {
                currentRange: selectedCurrentRange,
                previousRange: selectedPreviousRange,
                current: selectedCurrentStats,
                previous: selectedPreviousStats,
                comparison: selectedComparison,
                timelineChart,
                segmentation,
                topCustomers,
                recentCustomers,
                recentPayments
            },
            overview,
            systemStats
        });
    } catch (err) {
        console.error("Lỗi lấy thống kê khách hàng:", err);
        return error(res, "Lỗi lấy thống kê khách hàng: " + err.message);
    }
}

module.exports = {
    getBaoCaoKinhDoanh,
    getLichSuThanhToan,
    getThongKeKhachHang,
    computeMetricsForRange,
    computeCustomerMetricsForRange,
    getDayRange,
    getWeekRange,
    getMonthRange,
    getQuarterRange,
    getYearRange,
    parsePeriodRange
};
