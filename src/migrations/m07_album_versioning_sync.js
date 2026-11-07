/**
 * Migration M07: Album Review Versioning & Retouch Pin Normalization
 * 
 * Objectives:
 * 1. Scan all albums in Album collection.
 * 2. Backfill activeVersion (default 1) and currentVersionApproved.
 * 3. Backfill reviewVersions array with version 1 snapshot:
 *    - If khachHangXacNhan is true, status is 'APPROVED' with approvedAt timestamp.
 *    - If khachHangXacNhan is false, status is 'PENDING'.
 * 4. Scan all photo comments / retouch pins across danhSachAnh and danhSachAnhChinhSua:
 *    - Calculate normalizedX [0, 1] and normalizedY [0, 1] for pins having legacy coordinateX / coordinateY.
 *    - Calculate coordinateX [0, 100] and coordinateY [0, 100] for pins having only normalized coordinates.
 *    - Ensure pins are assigned review version (default 1).
 * 5. Strictly non-destructive and fully idempotent.
 */

const Album = require("../models/album.model");
const { normalizePinCoordinates } = require("../services/album.service");

async function runMigrationM07({ dryRun = true } = {}) {
  console.log(`🔍 [Migration M07] Bắt đầu đồng bộ Versioning Album & Chuẩn hóa tọa độ Pin (dryRun = ${dryRun})...`);

  let albumsScanned = 0;
  let albumsUpdated = 0;
  let pinsNormalized = 0;
  let reviewsCreated = 0;

  const albums = await Album.find({});
  albumsScanned = albums.length;

  for (const album of albums) {
    let modified = false;

    // 1. Initialize activeVersion
    if (!album.activeVersion || album.activeVersion < 1) {
      album.activeVersion = 1;
      modified = true;
    }

    // 2. Initialize reviewVersions if empty
    if (!album.reviewVersions || album.reviewVersions.length === 0) {
      const isApproved = Boolean(album.khachHangXacNhan);
      const selectedCount = (album.danhSachAnh || []).filter(p => p.isHearted).length;
      let totalPins = 0;
      (album.danhSachAnh || []).forEach(p => { totalPins += (p.comments?.length || 0); });
      (album.danhSachAnhChinhSua || []).forEach(p => { totalPins += (p.comments?.length || 0); });

      const initialReview = {
        version: 1,
        title: 'Bản chọn ảnh gốc v1',
        submittedAt: album.createdAt || new Date(),
        submittedBy: 'Ekip Studio',
        status: isApproved ? 'APPROVED' : 'PENDING',
        approvedAt: isApproved ? (album.ngayKhachXacNhan || album.updatedAt || new Date()) : null,
        approvedBy: isApproved ? 'Khách hàng' : null,
        approvalIp: '127.0.0.1',
        clientNote: '',
        photoSelectionsCount: selectedCount,
        retouchPinsCount: totalPins,
        auditTrail: [{
          action: isApproved ? 'APPROVED' : 'CREATED',
          actor: isApproved ? 'Khách hàng' : 'Ekip Studio',
          timestamp: isApproved ? (album.ngayKhachXacNhan || new Date()) : (album.createdAt || new Date()),
          details: { source: 'Migration M07' }
        }]
      };

      album.reviewVersions = [initialReview];
      album.currentVersionApproved = isApproved;
      reviewsCreated++;
      modified = true;
    }

    // 3. Normalize all photo comments / pins
    const photoLists = [album.danhSachAnh, album.danhSachAnhChinhSua];
    for (const list of photoLists) {
      if (!Array.isArray(list)) continue;
      for (const photo of list) {
        if (!Array.isArray(photo.comments)) continue;
        for (const comment of photo.comments) {
          if (comment.normalizedX === undefined || comment.normalizedY === undefined) {
            const normalized = normalizePinCoordinates({
              coordinateX: comment.coordinateX,
              coordinateY: comment.coordinateY,
              normalizedX: comment.normalizedX,
              normalizedY: comment.normalizedY,
              originalWidth: comment.originalWidth,
              originalHeight: comment.originalHeight
            });
            comment.normalizedX = normalized.normalizedX;
            comment.normalizedY = normalized.normalizedY;
            comment.coordinateX = normalized.coordinateX;
            comment.coordinateY = normalized.coordinateY;
            if (!comment.version) comment.version = 1;
            pinsNormalized++;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      albumsUpdated++;
      if (!dryRun) {
        await album.save();
      }
    }
  }

  const summary = {
    albumsScanned,
    albumsUpdated,
    reviewsCreated,
    pinsNormalized,
    dryRun
  };

  console.log(`✅ [Migration M07 Hoàn tất]`, summary);
  return summary;
}

if (require.main === module) {
  const mongoose = require("mongoose");
  require("dotenv").config();
  const uri = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/quanly-longwedding";
  mongoose.connect(uri).then(async () => {
    await runMigrationM07({ dryRun: process.argv.includes("--dry-run") || false });
    await mongoose.disconnect();
    process.exit(0);
  }).catch(err => {
    console.error("Migration M07 failed:", err);
    process.exit(1);
  });
}

module.exports = { runMigrationM07 };

