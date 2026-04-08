import express from "express";
import {
  getPlans,
  getRewards,
  getMySubscription,
  subscribe,
  redeemReward,
  consumeReward,
  earnPoints,
} from "../controllers/subscriptionController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/plans",   getPlans);
router.get("/rewards", getRewards);
router.get("/my",      protect, getMySubscription);
router.post("/subscribe", protect, subscribe);
router.post("/redeem",          protect, redeemReward);
router.patch("/consume-reward",  protect, consumeReward);
router.post("/earn",             protect, earnPoints);

export default router;
