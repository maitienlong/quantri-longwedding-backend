const mongoose = require("mongoose");

const printDeliverableSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true }, // e.g. "PRN-HD2026360-01"
    hopDongId: { type: mongoose.Schema.Types.ObjectId, ref: "hopDong" },
    maHopDong: { type: String, required: true, index: true },
    khachHangId: { type: mongoose.Schema.Types.ObjectId, ref: "KhachHang" },
    tenKhachHang: { type: String, default: "" },
    soDienThoai: { type: String, default: "" },

    // Thông tin sản phẩm in ấn / thành phẩm bàn giao
    tenSanPham: { type: String, required: true }, // e.g. "Ảnh phóng cổng tráng gương", "Photobook album cưới"
    phanLoai: {
        type: String,
        enum: ['ANH_PHONG_CONG', 'ALBUM_PHOTOBOOK', 'ANH_BAN', 'KHUNG_ANH', 'HOP_GO_USB', 'THIEP_VOUCHER', 'KHAC'],
        default: 'KHAC'
    },
    kichThuoc: { type: String, default: "" }, // e.g. "60x90", "30x30", "15x21"
    widthCm: { type: Number, default: 0 },
    heightCm: { type: Number, default: 0 },
    chatLieu: { type: String, default: "" }, // e.g. "Tráng gương viền bạc", "Pha lê", "Gỗ", "Da Ý"
    soLuong: { type: Number, default: 1, min: 1 },
    danhSachFileIn: [{
        tenFile: { type: String },
        url: { type: String },
        ghiChu: { type: String }
    }],
    isRequired: { type: Boolean, default: true }, // Sản phẩm bắt buộc hoàn thành để chốt hợp đồng (áp dụng QC Gate)

    // Trạng thái vòng đời sản phẩm
    trangThai: {
        type: String,
        enum: [
            'CHUA_GUI_IN',      // PENDING_PRINT: Mới tạo / Chờ gửi xưởng
            'DA_GUI_XUONG',     // SENT_TO_FACTORY: Đã gửi xưởng in
            'XUONG_DA_GIAO',    // FACTORY_COMPLETED: Xưởng đã giao về studio, chờ kiểm tra
            'QC_PASSED',        // QC_PASSED: Nghiệm thu QC đạt chuẩn chất lượng
            'QC_FAILED',        // QC_FAILED: Nghiệm thu QC không đạt (rách mép, lệch màu...)
            'DA_BAN_GIAO',      // DELIVERED_TO_CLIENT: Đã bàn giao cho cô dâu chú rể
            'DA_HUY'            // CANCELLED: Đã hủy sản phẩm
        ],
        default: 'CHUA_GUI_IN',
        index: true
    },

    // Thông tin theo dõi xưởng gia công (Factory Tracking)
    thongTinXuongIn: {
        tenXuongIn: { type: String, default: "" },
        soDienThoai: { type: String, default: "" },
        diaChi: { type: String, default: "" },
        ngayGuiIn: { type: Date },
        ngayHenTra: { type: Date },
        ngayNhanThucTe: { type: Date },
        chiPhiIn: { type: Number, default: 0 },
        maVanDon: { type: String, default: "" }, // Mã phiếu gửi / mã vận đơn bưu cục
        ghiChuXuong: { type: String, default: "" }
    },

    // Kiểm tra chất lượng sản phẩm (QC Acceptance Gate)
    kiemTraQC: {
        nguoiKiemTra: { type: String, default: "" },
        thoiGianKiemTra: { type: Date },
        ketQua: {
            type: String,
            enum: ['PENDING', 'PASSED', 'FAILED'],
            default: 'PENDING'
        },
        tieuChi: {
            dungKichThuoc: { type: Boolean, default: true },
            dungMauSac: { type: Boolean, default: true },
            khongTrayXuocRach: { type: Boolean, default: true },
            dungSoLuongTrang: { type: Boolean, default: true }
        },
        ghiChuLoi: { type: String, default: "" },
        hinhAnhLoi: [{ type: String }],
        yeuCauInLai: { type: Boolean, default: false },
        soLanInLai: { type: Number, default: 0 }
    },

    // Bàn giao cho khách hàng (Client Handover)
    banGiaoKhach: {
        ngayBanGiao: { type: Date },
        nguoiBanGiao: { type: String, default: "" },
        nguoiNhan: { type: String, default: "" },
        ghiChu: { type: String, default: "" }
    },

    // Quản lý Override khi có sự cố khẩn cấp (T-PRINT01)
    qcOverride: {
        isOverridden: { type: Boolean, default: false },
        overrideReason: { type: String, default: "" },
        approvedBy: { type: String, default: "" },
        approvedAt: { type: Date }
    },

    // Nhật ký kiểm toán bất biến
    auditLog: [
        {
            action: { type: String }, // 'CREATED', 'SENT_TO_FACTORY', 'RECEIVED_FROM_FACTORY', 'QC_INSPECTED', 'QC_OVERRIDDEN', 'DELIVERED', 'UPDATED'
            performedBy: { type: String },
            timestamp: { type: Date, default: Date.now },
            details: { type: mongoose.Schema.Types.Mixed }
        }
    ]
}, {
    timestamps: true
});

module.exports = mongoose.model("PrintDeliverable", printDeliverableSchema);

