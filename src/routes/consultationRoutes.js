import express from "express";
import {
  scheduleSession,
  getMySessions,
  getProviderSessions,
  acceptSession,
  rescheduleSession,
  confirmReschedule,
  cancelSession,
  getAvailableProviders,
  getAvailableServices,
} from "../controllers/consultationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/providers",          protect, getAvailableProviders);
router.get("/services",           protect, getAvailableServices);
router.get("/my",                 protect, getMySessions);
router.get("/provider",           protect, getProviderSessions);
router.post("/",                  protect, scheduleSession);
router.patch("/:id/accept",       protect, acceptSession);
router.patch("/:id/reschedule",   protect, rescheduleSession);
router.patch("/:id/confirm",      protect, confirmReschedule);
router.patch("/:id/cancel",       protect, cancelSession);

export default router;
