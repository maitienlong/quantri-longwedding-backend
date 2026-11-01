const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const DichVu = require("../models/dichVu.model");

async function rollback(specifiedFile = null) {
  console.log("=== BẮT ĐẦU ROLLBACK DỮ LIỆU DỊCH VỤ ===");
  const backupDir = path.join(__dirname, "../backups");
  let targetFile = specifiedFile;

  if (!targetFile) {
    if (!fs.existsSync(backupDir)) {
      throw new Error("Không tìm thấy thư mục backups!");
    }
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith("backup_dichvu_")).sort().reverse();
    if (files.length === 0) {
      throw new Error("Không có bản backup nào trong thư mục backups!");
    }
    targetFile = path.join(backupDir, files[0]);
  }

  console.log(`Đang khôi phục từ bản backup: ${targetFile}`);
  const rawData = fs.readFileSync(targetFile, "utf8");
  const backupItems = JSON.parse(rawData);

  const dbUri = process.env.DATABASE_URL || "mongodb://localhost:27017/longwedding";
  await mongoose.connect(dbUri);

  for (const item of backupItems) {
    await DichVu.replaceOne({ _id: item._id }, item, { upsert: true });
  }

  console.log(`✅ ROLLBACK THÀNH CÔNG: Đã khôi phục ${backupItems.length} bản ghi về trạng thái cũ.`);
  await mongoose.disconnect();
}

if (require.main === module) {
  rollback().catch(err => {
    console.error("Rollback failed:", err);
    process.exit(1);
  });
}

module.exports = rollback;

