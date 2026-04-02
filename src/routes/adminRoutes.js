import express from "express";
import {
  getPendingProviders,
  approveProvider
} from "../controllers/providerController.js";
import {
  getAdminStats,
  getAllUsers,
  toggleUserStatus,
  getGlobalAnalytics
} from "../controllers/adminController.js";

const router = express.Router();

// Stats and Users
router.get("/stats", getAdminStats);
router.get("/users", getAllUsers);
router.patch("/users/:id/status", toggleUserStatus);
router.get("/analytics", getGlobalAnalytics);

// Get pending providers for admin review
router.get("/pending-providers", getPendingProviders);

// Approve or reject provider
router.post("/approve-provider/:id", approveProvider);

export default router;