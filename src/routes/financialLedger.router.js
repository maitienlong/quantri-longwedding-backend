const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const checkRole = require("../middleware/role.middleware");
const { requirePermission } = require("../middleware/permission.middleware");
const financialLedgerService = require("../services/financialLedger.service");
const ReconciliationRun = require("../models/reconciliationRun.model");
const { success, error } = require("../utils/response");

// Áp dụng authMiddleware
router.use(authMiddleware);

/**
 * GET /api/v2/finance/ledger
 * Danh sách bút toán sổ cái kép (MOD-08)
 */
router.get("/ledger", requirePermission("doanhthu"), async (req, res) => {
    try {
        const result = await financialLedgerService.listLedgerEntries(req.query);
        return success(res, "Lấy danh sách sổ cái thành công", result);
    } catch (err) {
        return error(res, "Lỗi khi lấy sổ cái: " + err.message);
    }
});

/**
 * GET /api/v2/finance/ledger/contract/:maHopDong
 * Tóm tắt sổ cái theo mã hợp đồng
 */
router.get("/ledger/contract/:maHopDong", async (req, res) => {
    try {
        const result = await financialLedgerService.getLedgerSummaryForContract(req.params.maHopDong);
        if (!result) return error(res, "Không tìm thấy hợp đồng", 404);
        return success(res, "Lấy tóm tắt sổ cái hợp đồng thành công", result);
    } catch (err) {
        return error(res, "Lỗi khi lấy tóm tắt sổ cái hợp đồng: " + err.message);
    }
});

/**
 * POST /api/v2/finance/reconcile
 * Chạy tiến trình đối soát tài chính & phát hiện / sửa sai lệch (MOD-08, T-LEDGER01)
 */
router.post("/reconcile", checkRole(["Quản lý"]), async (req, res) => {
    try {
        const { dryRun, scope, contractCode, startDate, endDate } = req.body;
        const result = await financialLedgerService.runReconciliation({
            dryRun: dryRun !== undefined ? Boolean(dryRun) : true,
            scope: scope || 'ALL',
            contractCode,
            startDate,
            endDate,
            user: req.user?.username || req.user?.name || "Quản lý"
        });
        return success(res, "Chạy đối soát tài chính hoàn tất", result);
    } catch (err) {
        return error(res, "Lỗi khi thực hiện đối soát: " + err.message);
    }
});

/**
 * GET /api/v2/finance/reconciliation-runs
 * Danh sách lịch sử các đợt đối soát
 */
router.get("/reconciliation-runs", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const [runs, total] = await Promise.all([
            ReconciliationRun.find()
                .sort({ startedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ReconciliationRun.countDocuments()
        ]);

        return success(res, "Lấy danh sách các đợt đối soát thành công", {
            runs,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        return error(res, "Lỗi khi lấy danh sách đợt đối soát: " + err.message);
    }
});

/**
 * GET /api/v2/finance/reconciliation-runs/:id
 * Chi tiết đợt đối soát
 */
router.get("/reconciliation-runs/:id", async (req, res) => {
    try {
        const run = await ReconciliationRun.findById(req.params.id).lean();
        if (!run) return error(res, "Không tìm thấy đợt đối soát", 404);
        return success(res, "Lấy chi tiết đợt đối soát thành công", run);
    } catch (err) {
        return error(res, "Lỗi khi lấy chi tiết đối soát: " + err.message);
    }
});

/**
 * GET & POST /api/v2/finance/unified-summary
 * Single Source of Truth Financial Summary (T-REPORT01)
 */
const handleUnifiedSummary = async (req, res) => {
    try {
        const params = req.method === 'POST' ? req.body : req.query;
        const summary = await financialLedgerService.getUnifiedFinancialSummary(params);
        return success(res, "Lấy tổng hợp tài chính hợp nhất thành công", summary);
    } catch (err) {
        return error(res, "Lỗi khi tính toán tổng hợp tài chính hợp nhất: " + err.message);
    }
};

router.get("/unified-summary", requirePermission("doanhthu"), handleUnifiedSummary);
router.post("/unified-summary", requirePermission("doanhthu"), handleUnifiedSummary);

module.exports = router;

