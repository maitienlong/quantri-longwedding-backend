const KichThuocAnh = require("../models/kichThuocAnh.model");
const { success, error } = require("../utils/response");

const DEFAULT_SIZES = [
  { name: "16x21", widthCm: 16, heightCm: 21, isDefault: true, description: "Ảnh để bàn / kẹp album nhỏ" },
  { name: "20x30", widthCm: 20, heightCm: 30, isDefault: true, description: "Ảnh để bàn chuẩn" },
  { name: "30x45", widthCm: 30, heightCm: 45, isDefault: true, description: "Ảnh phóng vừa / cổng phụ" },
  { name: "40x60", widthCm: 40, heightCm: 60, isDefault: true, description: "Ảnh cổng gia đình" },
  { name: "50x75", widthCm: 50, heightCm: 75, isDefault: true, description: "Ảnh phóng lớn phòng khách" },
  { name: "60x90", widthCm: 60, heightCm: 90, isDefault: true, description: "Ảnh cổng cưới chuẩn Mika HD" },
  { name: "70x105", widthCm: 70, heightCm: 105, isDefault: true, description: "Ảnh đại sảnh tiệc" },
  { name: "80x120", widthCm: 80, heightCm: 120, isDefault: true, description: "Ảnh phóng lớn cao cấp" }
];

async function ensureDefaultSizes() {
  try {
    const count = await KichThuocAnh.countDocuments();
    if (count === 0) {
      for (const s of DEFAULT_SIZES) {
        await KichThuocAnh.create(s);
      }
      console.log("[KichThuocAnh] Đã khởi tạo các khổ ảnh mặc định vào cơ sở dữ liệu!");
    }
  } catch (err) {
    console.error("Lỗi ensureDefaultSizes:", err.message);
  }
}

async function list(req, res) {
  try {
    await ensureDefaultSizes();
    const sizes = await KichThuocAnh.find().sort({ widthCm: 1, heightCm: 1 }).lean();
    return success(res, "Lấy danh mục kích thước thành công", sizes);
  } catch (err) {
    return error(res, err.message);
  }
}

async function create(req, res) {
  try {
    const { name, widthCm, heightCm, unit, description } = req.body;
    const w = Number(widthCm);
    const h = Number(heightCm);

    if (!w || w <= 0 || !h || h <= 0) {
      return error(res, "Kích thước chiều rộng và chiều cao phải lớn hơn 0");
    }

    const cleanName = (name && name.trim()) || `${w}x${h}`;

    const existing = await KichThuocAnh.findOne({ name: cleanName });
    if (existing) {
      return success(res, "Kích thước đã tồn tại trong danh mục", existing);
    }

    const newSize = await KichThuocAnh.create({
      name: cleanName,
      widthCm: w,
      heightCm: h,
      unit: unit || "cm",
      isDefault: false,
      description: description ? description.trim() : ""
    });

    return success(res, "Thêm kích thước mới thành công", newSize);
  } catch (err) {
    return error(res, err.message);
  }
}

module.exports = {
  list,
  create,
  ensureDefaultSizes,
  DEFAULT_SIZES
};

