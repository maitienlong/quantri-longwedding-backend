const express = require("express");
const router = express.Router();
const workflowEngine = require("../services/workflowEngine");
const authMiddleware = require("../middleware/auth.middleware");

// Tasks
router.get("/", authMiddleware, workflowEngine.listTasks);
router.get("/list", authMiddleware, workflowEngine.listTasks);
router.patch("/:id", authMiddleware, workflowEngine.updateTask);
router.put("/:id", authMiddleware, workflowEngine.updateTask);

// Instantiate workflow for contract
router.post("/contracts/:id/workflow/instantiate", authMiddleware, workflowEngine.instantiateWorkflowEndpoint);

// Notifications
router.get("/notifications", authMiddleware, workflowEngine.listNotifications);
router.post("/notifications/outbox/process", authMiddleware, async (req, res) => {
    try {
        const result = await workflowEngine.processOutbox(req.body);
        return res.status(200).json({ status: "success", data: result });
    } catch (err) {
        return res.status(500).json({ status: "error", message: err.message });
    }
});

module.exports = router;

