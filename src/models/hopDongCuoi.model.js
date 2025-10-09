const mongoose = require("mongoose");

const hopDongSchema = new mongoose.Schema({
  maHopDong: { type: String, required: true, unique: true },
  ngayKy: { type: Date, required: true, default: Date.now },

  khachHang: {
    coDau: { type: String, required: true },
    chuRe: { type: String, required: true }
  },

  noiDungDichVu: {
    chupPreWedding: {
      goi: { type: String },
      gia: { type: Number },
      ghiChu: { type: String }
    },
    chupPhongSuCuoi: {
      goi: { type: String },
      gia: { type: Number },
      ghiChu: { type: String }
    },
    quayPhongSuCuoi: {
      goi: { type: String },
      gia: { type: Number },
      ghiChu: { type: String }
    },
    trangDiem: {
      goi: { type: String },
      gia: { type: Number },
      ghiChu: { type: String }
    },
    ngayChup: { type: Date },
    ngayAnHoi: { type: Date },
    ngayLeCuoi: { type: Date },

    album: {
      kichThuoc: { type: String },
      soTrang: { type: Number },
      loaiBia: { type: String }
    },
    anhBoLon: {
      kichThuoc: { type: String },
      soLuong: { type: Number }
    },
    anhKinhCuongLuc: {
      kichThuoc: { type: String },
      soLuong: { type: Number }
    },
    anhKinhLed: {
      kichThuoc: { type: String },
      soLuong: { type: Number }
    },
    anhKhungTreotuong: {
      kichThuoc: { type: String },
      soLuong: { type: Number }
    },
    anhDeBan: {
      kichThuoc: { type: String },
      soLuong: { type: Number }
    },
    doDiTrangAnHoi: { type: [String] },
    aoDaiAnHoi: { type: String },
    vestNgayCuoi: { type: String }
  },

  thanhToan: {
    tongGiaTri: { type: Number, required: true },
    lan1: {
      moTa: { type: String, default: "Đặt cọc đảm bảo thực hiện dịch vụ" },
      soTien: { type: Number }
    },
    lan2: {
      moTa: { type: String, default: "Thanh toán trước khi chụp hình (80%)" },
      soTien: { type: Number }
    },
    lan3: {
      moTa: { type: String, default: "Thanh toán trước khi bàn giao ấn phẩm (còn lại)" },
      soTien: { type: Number }
    }
  },

  ghiChu: {
    loaiAnh: { type: [String] },
    luuY: { type: String },
    daCoc: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  collection: "hopdongs"
});

module.exports = mongoose.model("HopDongCuoi", hopDongSchema);
