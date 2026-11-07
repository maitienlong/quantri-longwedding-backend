/**
 * Migration M10: RBAC Granular Permissions & Invitation Owner Policy Sync
 * (MOD-10, MOD-11)
 * 
 * Objectives:
 * 1. Scan all users in the system.
 * 2. Backfill empty/missing permissions arrays based on user position / role presets.
 * 3. Scan all wedding invitations in ThiepCuoi collection.
 * 4. Backfill missing createdBy, creator, customerId references.
 * 5. Strictly non-destructive and fully idempotent.
 */

const User = require("../models/user.model");
const ThiepCuoi = require("../models/thiepCuoi.model");

// Preset mapping based on permissionHelper.js
const POSITION_PERMISSION_MAP = {
    'Quản lý': ['*'],
    'Admin': ['*'],
    'Quản trị viên': ['*'],
    'Sale': ['tongquan', 'banhang', 'lichcuahang', 'lichSoanDo', 'quanlytrangphuc', 'quanlykhachhang', 'leads', 'thi-dua', 'quanlyvoucher'],
    'Bán hàng': ['tongquan', 'banhang', 'lichcuahang', 'lichSoanDo', 'quanlytrangphuc', 'quanlykhachhang', 'leads', 'thi-dua', 'quanlyvoucher'],
    'Lễ tân': ['tongquan', 'banhang', 'lichcuahang', 'lichSoanDo', 'quanlytrangphuc', 'quanlykhachhang', 'leads', 'thi-dua', 'quanlyvoucher'],
    'Thợ chụp': ['tongquan', 'lichcuahang', 'lichSoanDo', 'thi-dua'],
    'Makeup': ['tongquan', 'lichcuahang', 'lichSoanDo', 'thi-dua'],
    'Photoshop': ['tongquan', 'lichcuahang', 'lichSoanDo', 'thi-dua'],
    'Hậu kỳ': ['tongquan', 'lichcuahang', 'lichSoanDo', 'thi-dua'],
    'Kho': ['tongquan', 'lichSoanDo', 'quanlytrangphuc', 'quanlykho', 'thi-dua'],
    'Trang phục': ['tongquan', 'lichSoanDo', 'quanlytrangphuc', 'quanlykho', 'thi-dua'],
    'Kế toán': ['tongquan', 'banhang', 'quanlychitieu', 'doanhthu', 'quanlykhachhang', 'thi-dua'],
    'Thu ngân': ['tongquan', 'banhang', 'quanlychitieu', 'doanhthu', 'quanlykhachhang', 'thi-dua'],
    'Marketing': ['tongquan', 'quanlywebsite', 'quanlyvoucher', 'leads', 'quanlykhachhang']
};

async function runMigrationM10({ dryRun = true } = {}) {
    console.log(`[Migration M10] Bắt đầu đồng bộ phân quyền RBAC & Owner Policy (dryRun = ${dryRun})...`);

    let usersScanned = 0;
    let usersUpdated = 0;
    let invitationsScanned = 0;
    let invitationsUpdated = 0;

    // 1. Sync User Granular Permissions (MOD-10)
    const users = await User.find({});
    usersScanned = users.length;

    for (const u of users) {
        const hasPermissions = Array.isArray(u.permissions) && u.permissions.length > 0;
        if (!hasPermissions) {
            let assignedPermissions = ['tongquan', 'banhang', 'lichcuahang', 'lichSoanDo']; // Default staff
            const pos = u.positon || "";

            for (const [key, perms] of Object.entries(POSITION_PERMISSION_MAP)) {
                if (pos.toLowerCase().includes(key.toLowerCase())) {
                    assignedPermissions = perms;
                    break;
                }
            }

            usersUpdated++;
            if (!dryRun) {
                u.permissions = assignedPermissions;
                await u.save();
            }
        }
    }

    // 2. Sync Wedding Invitation Ownership (MOD-11)
    const invitations = await ThiepCuoi.find({});
    invitationsScanned = invitations.length;

    for (const inv of invitations) {
        let needsUpdate = false;
        const updates = {};

        if (!inv.customerId && inv.khachHangId) {
            updates.customerId = String(inv.khachHangId);
            needsUpdate = true;
        }

        if (!inv.creator) {
            updates.creator = inv.customerId || "SystemMigration";
            needsUpdate = true;
        }

        if (needsUpdate) {
            invitationsUpdated++;
            if (!dryRun) {
                Object.assign(inv, updates);
                await inv.save();
            }
        }
    }

    const summary = {
        usersScanned,
        usersUpdated,
        invitationsScanned,
        invitationsUpdated,
        dryRun
    };

    console.log(`[Migration M10 Hoàn tất]`, summary);
    return summary;
}

if (require.main === module) {
    const mongoose = require("mongoose");
    require("dotenv").config();
    const uri = process.env.DATABASE_URL || "mongodb://127.0.0.1:27017/quanly-longwedding";
    mongoose.connect(uri).then(async () => {
        await runMigrationM10({ dryRun: process.argv.includes("--dry-run") || false });
        await mongoose.disconnect();
        process.exit(0);
    }).catch(err => {
        console.error("Migration M10 failed:", err);
        process.exit(1);
    });
}

module.exports = { runMigrationM10 };
