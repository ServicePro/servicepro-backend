import express from "express";
import {
  getPendingProviders,
  approveProvider
} from "../controllers/providerController.js";

const router = express.Router();

// Get pending providers for admin review
router.get("/pending-providers", getPendingProviders);

// Approve or reject provider
router.post("/approve-provider/:id", approveProvider);

export default router;