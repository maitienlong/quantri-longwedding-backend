const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });
const DichVu = require("../models/dichVu.model");
const backupPackages = require("./backupPackages");
const { migrateLegacyToDetails } = require("../utils/legacyPackageAdapter");

async function migrate() {
  console.log("=== BẮT ĐẦU QUÁ TRÌNH MIGRATION GÓI DỊCH VỤ SANG SCHEMA V2 ===");
  const backupFile = await backupPackages();
  console.log(`[Backup Checkpoint] Đã lưu dữ liệu trước khi migrate: ${backupFile}`);

  const dbUri = process.env.DATABASE_URL || "mongodb://localhost:27017/longwedding";
  await mongoose.connect(dbUri);

  const packages = await DichVu.find({ loaiDichVu: 2 });
  console.log(`Tìm thấy ${packages.length} gói dịch vụ cần kiểm tra migration.`);

  let migratedCount = 0;
  for (const pkg of packages) {
    const details = migrateLegacyToDetails(pkg);
    if (!details) continue;

    await DichVu.updateOne(
      { _id: pkg._id },
      {
        $set: {
          schemaVersion: 2,
          details: details
        }
      }
    );
    migratedCount++;
    console.log(`  -> Đã migrate gói: [${pkg.maDichVu}] "${pkg.tenDichVu}" - Deliverables: ${details.deliverables?.length || 0}, Makeup: ${details.makeupSessions?.length || 0}`);
  }

  console.log(`✅ HOÀN TẤT MIGRATION: ${migratedCount}/${packages.length} gói đã chuyển sang Schema v2!`);
  await mongoose.disconnect();
}

if (require.main === module) {
  migrate().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}

module.exports = migrate;

