import express from "express";
import {
  getPendingProviders,
  approveProvider,
  rejectProvider
} from "../controllers/adminController.js";

import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// 📥 Get all pending providers
router.get("/providers", protect, adminOnly, getPendingProviders);

// ✅ Approve provider
router.put("/approve/:id", protect, adminOnly, approveProvider);

// ❌ Reject provider
router.put("/reject/:id", protect, adminOnly, rejectProvider);

export default router;