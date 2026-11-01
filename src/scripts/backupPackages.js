const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const DichVu = require("../models/dichVu.model");

async function backup() {
  const dbUri = process.env.DATABASE_URL || "mongodb://localhost:27017/longwedding";
  await mongoose.connect(dbUri);
  console.log("Connected to MongoDB for Backup");

  const services = await DichVu.find().lean();
  const backupDir = path.join(__dirname, "../backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `backup_dichvu_${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(services, null, 2), "utf8");

  console.log(`✅ Đã sao lưu ${services.length} bản ghi dịch vụ vào file: ${backupPath}`);
  await mongoose.disconnect();
  return backupPath;
}

if (require.main === module) {
  backup().catch(err => {
    console.error("Backup failed:", err);
    process.exit(1);
  });
}

module.exports = backup;

