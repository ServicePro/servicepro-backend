import express from "express";

import {
  getAdminStats,
  getAllUsers,
  toggleUserStatus,
  getGlobalAnalytics,
  getPendingProviders,
  approveProvider,
  rejectProvider
} from "../controllers/adminController.js";

import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();


// ==============================
// 🔐 ALL ROUTES PROTECTED (ADMIN ONLY)
// ==============================

// 📊 Dashboard stats
router.get("/stats", protect, adminOnly, getAdminStats);

// 👥 All users + providers
router.get("/users", protect, adminOnly, getAllUsers);

// 🔄 Toggle user/provider status
router.patch("/users/:id/status", protect, adminOnly, toggleUserStatus);

// 📈 Analytics
router.get("/analytics", protect, adminOnly, getGlobalAnalytics);


// ==============================
// 🧑‍🔧 PROVIDER MANAGEMENT
// ==============================

// 📥 Pending providers
router.get("/providers/pending", protect, adminOnly, getPendingProviders);

// ✅ Approve provider
router.put("/providers/approve/:id", protect, adminOnly, approveProvider);

// ❌ Reject provider
router.put("/providers/reject/:id", protect, adminOnly, rejectProvider);


export default router;