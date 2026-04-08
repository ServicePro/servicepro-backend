import express from "express";
import {
    approveProvider,
    changePassword,
    getFeaturedProviders,
    getMe,
    getPendingProviders,
    registerProvider,
    searchProviders,
    updateProfile
} from "../controllers/providerController.js";
import { protect } from "../middleware/authMiddleware.js";
import { uploadProviderDocs } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Provider registration (with optional file uploads)
router.post("/register", uploadProviderDocs, registerProvider);

// Admin routes
router.get("/pending-providers", getPendingProviders);
router.post("/approve-provider/:id", approveProvider);

// Public search (used by user chat "New Conversation" modal)
router.get("/featured", getFeaturedProviders);
router.get("/search", searchProviders);

// Provider authenticated routes
router.get("/me", protect, getMe);
router.put("/profile", protect, uploadProviderDocs, updateProfile);
router.put("/change-password", protect, changePassword);

export default router;