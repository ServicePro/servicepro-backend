import express from "express";
import {
  registerProvider,
  getPendingProviders,
  approveProvider,
  getMe,
  updateProfile,
  changePassword
} from "../controllers/providerController.js";
import { uploadProviderDocs } from "../middleware/uploadMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Provider registration (with optional file uploads)
router.post("/register", uploadProviderDocs, registerProvider);

// Admin routes
router.get("/pending-providers", getPendingProviders);
router.post("/approve-provider/:id", approveProvider);

// Provider authenticated routes
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;