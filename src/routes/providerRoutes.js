import express from "express";
import {
  registerProvider,
  getPendingProviders,
  approveProvider
} from "../controllers/providerController.js";
import { uploadProviderDocs } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Provider registration (with optional file uploads)
router.post("/register", uploadProviderDocs, registerProvider);

// Admin routes
router.get("/pending-providers", getPendingProviders);
router.post("/approve-provider/:id", approveProvider);

export default router;