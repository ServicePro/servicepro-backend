import Subscription from "../models/Subscription.js";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    billing: "Forever",
    color: "#64748b",
    badge: null,
    features: [
      "Up to 3 bookings / month",
      "Standard response time",
      "Email support",
      "Basic service history",
    ],
    excluded: [
      "Priority booking",
      "Emergency services",
      "Loyalty rewards",
      "Video consultations",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    price: 9.99,
    billing: "/ month",
    color: "#2563eb",
    badge: "Popular",
    features: [
      "Unlimited bookings",
      "Priority support",
      "10% discount on all services",
      "100 loyalty points on signup",
      "Access to emergency services",
      "Full service history & invoices",
    ],
    excluded: ["Video consultations", "VR/AR previews"],
  },
  {
    id: "premium",
    name: "Premium",
    price: 19.99,
    billing: "/ month",
    color: "#f59e0b",
    badge: "Best Value",
    features: [
      "Everything in Standard",
      "20% discount on all services",
      "250 loyalty points on signup",
      "Video consultation sessions",
      "VR/AR service previews",
      "Dedicated account manager",
      "Priority emergency dispatch",
    ],
    excluded: [],
  },
];

const REWARDS = [
  { id: "r1", title: "10% Off Next Booking",   pointsCost: 150, type: "discount",      value: "10%" },
  { id: "r2", title: "20% Off Next Booking",   pointsCost: 280, type: "discount",      value: "20%" },
  { id: "r3", title: "Free Service Call",       pointsCost: 500, type: "free_service",  value: "1 service" },
  { id: "r4", title: "Priority Queue Upgrade", pointsCost: 100, type: "priority",      value: "1 booking" },
  { id: "r5", title: "$5 Credit",              pointsCost: 200, type: "credit",        value: "$5" },
];

// GET /api/subscriptions/plans
export const getPlans = async (req, res) => {
  res.json({ success: true, data: PLANS });
};

// GET /api/subscriptions/rewards  
export const getRewards = async (req, res) => {
  res.json({ success: true, data: REWARDS });
};

// GET /api/subscriptions/my
export const getMySubscription = async (req, res) => {
  try {
    let sub = await Subscription.findOne({ userId: req.user.id });
    if (!sub) {
      sub = await Subscription.create({ userId: req.user.id });
    }
    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/subscriptions/subscribe  body: { plan }
export const subscribe = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!["free", "standard", "premium"].includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    const planConfig = PLANS.find((p) => p.id === plan);
    const bonusPoints = plan === "premium" ? 250 : plan === "standard" ? 100 : 0;

    let sub = await Subscription.findOne({ userId: req.user.id });
    if (!sub) sub = new Subscription({ userId: req.user.id });

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    sub.plan = plan;
    sub.startDate = new Date();
    sub.endDate = endDate;

    if (bonusPoints > 0) {
      sub.loyaltyPoints += bonusPoints;
      sub.pointsHistory.push({
        points: bonusPoints,
        description: `${planConfig.name} plan signup bonus`,
        type: "earned",
      });
    }

    await sub.save();
    res.json({ success: true, data: sub, message: `Subscribed to ${planConfig.name} plan!` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/subscriptions/redeem  body: { rewardId }
export const redeemReward = async (req, res) => {
  try {
    const { rewardId } = req.body;
    const reward = REWARDS.find((r) => r.id === rewardId);
    if (!reward) return res.status(404).json({ success: false, message: "Reward not found" });

    let sub = await Subscription.findOne({ userId: req.user.id });
    if (!sub) return res.status(400).json({ success: false, message: "No subscription found" });

    if (sub.loyaltyPoints < reward.pointsCost) {
      return res.status(400).json({ success: false, message: "Not enough loyalty points" });
    }

    // Only one pending reward at a time
    if (sub.pendingReward?.rewardId) {
      return res.status(400).json({
        success: false,
        message: "You already have a reward waiting to be used. Apply it on your next booking or emergency first.",
      });
    }

    sub.loyaltyPoints -= reward.pointsCost;
    sub.pointsHistory.push({
      points: -reward.pointsCost,
      description: `Redeemed: ${reward.title}`,
      type: "redeemed",
    });

    // Store reward as pending — will be consumed at next checkout
    sub.pendingReward = {
      rewardId: reward.id,
      title:    reward.title,
      type:     reward.type,
      value:    reward.value,
    };

    await sub.save();
    res.json({
      success: true,
      data: sub,
      rewardClaimed: reward,
      message: `${reward.title} redeemed! It will be automatically applied on your next booking or emergency payment.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/subscriptions/consume-reward  (called at checkout after payment succeeds)
export const consumeReward = async (req, res) => {
  try {
    let sub = await Subscription.findOne({ userId: req.user.id });
    if (!sub || !sub.pendingReward?.rewardId) {
      return res.status(404).json({ success: false, message: "No pending reward to consume" });
    }

    const consumed = { ...sub.pendingReward.toObject() };
    sub.pendingReward = { rewardId: null, title: null, type: null, value: null };
    await sub.save();

    res.json({ success: true, data: sub, consumed, message: "Reward applied and cleared." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/subscriptions/earn  body: { points, description }  (called internally after booking)
export const earnPoints = async (req, res) => {
  try {
    const { points, description } = req.body;
    if (!points || points <= 0) return res.status(400).json({ success: false, message: "Invalid points" });

    let sub = await Subscription.findOne({ userId: req.user.id });
    if (!sub) sub = new Subscription({ userId: req.user.id });

    sub.loyaltyPoints += points;
    sub.pointsHistory.push({ points, description: description || "Booking reward", type: "earned" });
    await sub.save();

    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Internal helper — call from other controllers to award points without an HTTP round-trip.
 * @param {string} userId  - Mongoose ObjectId string
 * @param {number} points  - positive integer
 * @param {string} description - displayed in points history
 */
export async function awardLoyaltyPoints(userId, points, description) {
  try {
    let sub = await Subscription.findOne({ userId });
    if (!sub) sub = new Subscription({ userId });
    sub.loyaltyPoints += points;
    sub.pointsHistory.push({ points, description, type: "earned" });
    await sub.save();
  } catch (_) {
    // Non-critical — never let points failure break the main action
  }
}
