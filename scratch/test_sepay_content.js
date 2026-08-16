const testCases = [
    "MBVCB.123456789.HD2026360.CT TU NGUYEN VAN A",
    "Chuyen tien HD260816 khach hang anh A",
    "HD-2026-360 thanh toan dot 1",
    "Noidung HD 026360 S8421",
    "HD123456",
    "CK HD-123456 noi dung",
    "CT TU CTK KHAC HD2026081612"
];

const prefix = "HD";

testCases.forEach((cleanContent) => {
    const regex = new RegExp(`(?:${prefix})[-\\s]?(\\d[\\d-\\s]*)`, "i");
    const match = cleanContent.match(regex);
    if (match) {
        const rawDigits = match[1].replace(/\D/g, "");
        const last6Digits = rawDigits.length >= 6 ? rawDigits.slice(-6) : rawDigits;
        const code6 = `${prefix}${last6Digits}`;
        const codeFull = `${prefix}${rawDigits}`;
        console.log(`Input: "${cleanContent}" => Code6: "${code6}", CodeFull: "${codeFull}", last6Digits: "${last6Digits}"`);
    } else {
        const fallbackDigitsMatch = cleanContent.match(/\d{6,}/);
        if (fallbackDigitsMatch) {
            const rawDigits = fallbackDigitsMatch[0];
            const last6Digits = rawDigits.slice(-6);
            const code6 = `${prefix}${last6Digits}`;
            console.log(`Input: "${cleanContent}" => Fallback Code6: "${code6}"`);
        } else {
            console.log(`Input: "${cleanContent}" => NO MATCH`);
        }
    }
});
