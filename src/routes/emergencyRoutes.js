import express from "express";
import {
  getServiceTypes,
  getEmergencyProviders,
  createRequest,
  getMyRequests,
  cancelRequest,
  payEmergency,
  getEmergencyById,
  getForProviderRequests,
  acceptRequest,
  completeRequest,
  rateRequest,
} from "../controllers/emergencyController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.get("/services",                    getServiceTypes);
router.get("/providers",                   getEmergencyProviders);

// User routes
router.post("/",            protect,       createRequest);
router.get("/my",           protect,       getMyRequests);
router.patch("/:id/cancel", protect,       cancelRequest);
router.patch("/:id/pay",    protect,       payEmergency);

// Provider routes (must be before /:id to avoid conflict)
router.get("/for-provider",   protect,     getForProviderRequests);
router.patch("/:id/accept",   protect,     acceptRequest);
router.patch("/:id/rate",     protect,     rateRequest);
router.patch("/:id/complete", protect,     completeRequest);

// User polling — must be last
router.get("/:id",          protect,       getEmergencyById);

export default router;
