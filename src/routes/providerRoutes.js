import express from "express";
import {
  registerProvider,
  getPendingProviders,
  approveProvider,
  getMe,
  updateProfile,
  changePassword,
  searchProviders,
  getFeaturedProviders,
} from "../controllers/providerController.js";
import { uploadProviderDocs } from "../middleware/uploadMiddleware.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Provider registration (with optional file uploads)
router.post("/register", uploadProviderDocs, registerProvider);

// Admin routes
router.get("/pending-providers", getPendingProviders);
router.post("/approve-provider/:id", approveProvider);

// Public: top-rated providers for landing page
router.get("/featured", getFeaturedProviders);

// Public search (used by user chat "New Conversation" modal)
router.get("/search", searchProviders);

// Provider authenticated routes
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;