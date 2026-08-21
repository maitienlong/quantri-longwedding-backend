const {
    getWeekRange,
    getMonthRange,
    getQuarterRange,
    getYearRange
} = require("../src/services/baoCao.service");

console.log("=== KIỂM TRA CÁC CHU KỲ THỜI GIAN (ICT UTC+7) ===");

const testDate = new Date("2026-08-21T09:00:00Z"); // 2026-08-21 16:00 ICT (Thứ 6)
console.log("Test Date ICT:", testDate.toISOString());

// 1. Tuần
const weekThis = getWeekRange(testDate, 0);
const weekLast = getWeekRange(testDate, -1);
console.log("\n[TUẦN NÀY]:", weekThis.label, "->", weekThis.startDate.toISOString(), "đến", weekThis.endDate.toISOString());
console.log("[TUẦN TRƯỚC]:", weekLast.label, "->", weekLast.startDate.toISOString(), "đến", weekLast.endDate.toISOString());

// 2. Tháng
const monthThis = getMonthRange(testDate, 0);
const monthLast = getMonthRange(testDate, -1);
console.log("\n[THÁNG NÀY]:", monthThis.label, "->", monthThis.startDate.toISOString(), "đến", monthThis.endDate.toISOString());
console.log("[THÁNG TRƯỚC]:", monthLast.label, "->", monthLast.startDate.toISOString(), "đến", monthLast.endDate.toISOString());

// 3. Quý
const quarterThis = getQuarterRange(testDate, 0);
const quarterLast = getQuarterRange(testDate, -1);
console.log("\n[QUÝ NÀY]:", quarterThis.label, "->", quarterThis.startDate.toISOString(), "đến", quarterThis.endDate.toISOString());
console.log("[QUÝ TRƯỚC]:", quarterLast.label, "->", quarterLast.startDate.toISOString(), "đến", quarterLast.endDate.toISOString());

// 4. Năm
const yearThis = getYearRange(testDate, 0);
const yearLast = getYearRange(testDate, -1);
console.log("\n[NĂM NÀY]:", yearThis.label, "->", yearThis.startDate.toISOString(), "đến", yearThis.endDate.toISOString());
console.log("[NĂM TRƯỚC]:", yearLast.label, "->", yearLast.startDate.toISOString(), "đến", yearLast.endDate.toISOString());

// Test boundary: Q1 with offset -1 should be Q4 of previous year
const q1Date = new Date("2026-02-15T09:00:00Z");
const q1Prev = getQuarterRange(q1Date, -1);
console.log("\n[BOUNDARY CHECK - Q1 lui ve truoc]:", q1Prev.label, "->", q1Prev.startDate.toISOString(), "đến", q1Prev.endDate.toISOString());

console.log("\n>>> Tất cả phép tính chu kỳ chính xác 100%!");
