// src/utils/dateUtils.js
// Tiện ích xử lý múi giờ Việt Nam (ICT UTC+7) dùng chung cho toàn bộ Backend

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

function getICTDateTimeString() {
    const now = new Date();
    const tzOffset = 7 * 60;
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
    const tzOffset = 7 * 60;
    const ictDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + (tzOffset * 60000));
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(ictDate.getHours())}:${pad(ictDate.getMinutes())} ngày ${pad(ictDate.getDate())}/${pad(ictDate.getMonth() + 1)}/${ictDate.getFullYear()}`;
}

module.exports = {
    getICTComponents,
    makeICTDate,
    getICTDateTimeString,
    formatICTDateTime
};

