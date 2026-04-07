import EmergencyRequest from "../models/EmergencyRequest.js";
import Service from "../models/Service.js";
import { awardLoyaltyPoints } from "./subscriptionController.js";

const EMERGENCY_SERVICES = [
  { id: "plumbing",    label: "Emergency Plumbing",    basePrice: 80,  icon: "🔧" },
  { id: "electrical",  label: "Emergency Electrical",  basePrice: 100, icon: "⚡" },
  { id: "cleaning",    label: "Emergency Cleaning",    basePrice: 60,  icon: "🧹" },
  { id: "pest",        label: "Emergency Pest Control",basePrice: 70,  icon: "🐛" },
  { id: "hvac",        label: "Emergency HVAC",        basePrice: 120, icon: "❄️" },
  { id: "carpentry",   label: "Emergency Carpentry",   basePrice: 90,  icon: "🪚" },
  { id: "painting",    label: "Emergency Painting",    basePrice: 70,  icon: "🎨" },
  { id: "landscaping", label: "Emergency Landscaping", basePrice: 80,  icon: "🌿" },
  { id: "home_repair", label: "Emergency Home Repair", basePrice: 85,  icon: "🏠" },
  { id: "moving",      label: "Emergency Moving",      basePrice: 110, icon: "🚛" },
];

const URGENCY_MULTIPLIER = { high: 1.5, critical: 2.0 };

// GET /api/emergency/services
export const getServiceTypes = async (req, res) => {
  res.json({ success: true, data: EMERGENCY_SERVICES });
};

// GET /api/emergency/providers?type=plumbing
export const getEmergencyProviders = async (req, res) => {
  try {
    const { type } = req.query;
    const categoryMap = {
      plumbing:    ['Plumbing'],
      electrical:  ['Electrical'],
      cleaning:    ['Cleaning'],
      pest:        ['Cleaning'],
      hvac:        ['HVAC'],
      carpentry:   ['Carpentry'],
      painting:    ['Painting'],
      landscaping: ['Landscaping'],
      home_repair: ['Home Repair'],
      moving:      ['Moving'],
      general:     ['Plumbing','Electrical','Home Repair','Cleaning','Carpentry','HVAC','Painting','Landscaping','Moving'],
    };
    const cats = categoryMap[type] || categoryMap.general;
    const services = await Service.find({
      status: 'active',
      category: { $in: cats },
    })
      .populate('providerId', 'name profile_image rating area availability')
      .limit(10)
      .lean();

    const seen = new Set();
    const providers = [];
    for (const s of services) {
      const pid = s.providerId?._id?.toString();
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        providers.push({
          _id:              s.providerId._id,
          name:             s.providerId.name,
          profile_image:    s.providerId.profile_image,
          rating:           s.providerId.rating,
          area:             s.providerId.area,
          availability:     s.providerId.availability,
          serviceId:        s._id,
          serviceName:      s.name,
          baseServicePrice: s.price,
          category:         s.category,
        });
      }
    }
    res.json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/emergency
export const createRequest = async (req, res) => {
  try {
    const { serviceType, description, location, urgency, providerId, basePrice } = req.body;
    if (!serviceType || !description || !location) {
      return res.status(400).json({ success: false, message: "serviceType, description, location are required" });
    }

    const svc = EMERGENCY_SERVICES.find((s) => s.id === serviceType);
    if (!svc) return res.status(400).json({ success: false, message: "Unknown service type" });

    const urg = urgency || "high";
    const mult = URGENCY_MULTIPLIER[urg] || 1.5;
    // Use provider-specific price if supplied, otherwise fall back to service default
    const effectiveBase = basePrice ? +basePrice : svc.basePrice;
    const finalPrice = +(effectiveBase * mult).toFixed(2);

    const minutes = urg === "critical" ? Math.floor(Math.random() * 15) + 15 : Math.floor(Math.random() * 20) + 25;
    const eta = `${minutes} mins`;

    const request = await EmergencyRequest.create({
      userId: req.user.id,
      serviceType,
      description,
      location,
      urgency: urg,
      basePrice: effectiveBase,
      finalPrice,
      eta,
      ...(providerId ? { providerId } : {}),
    });

    res.status(201).json({ success: true, data: request, message: `Emergency request created. ETA: ${eta}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/emergency/:id  (user polls their own request)
export const getEmergencyById = async (req, res) => {
  try {
    const request = await EmergencyRequest.findOne({ _id: req.params.id, userId: req.user.id });
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/emergency/for-provider  (provider sees requests directed to them)
export const getForProviderRequests = async (req, res) => {
  try {
    const requests = await EmergencyRequest.find({ providerId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/emergency/:id/accept  (provider accepts a request)
export const acceptRequest = async (req, res) => {
  try {
    const request = await EmergencyRequest.findOne({ _id: req.params.id, providerId: req.user.id, status: "pending" });
    if (!request) return res.status(404).json({ success: false, message: "Request not found or already processed" });

    const minutes = request.urgency === "critical"
      ? Math.floor(Math.random() * 15) + 15
      : Math.floor(Math.random() * 20) + 25;
    request.status = "assigned";
    request.eta = `${minutes} mins`;
    await request.save();

    res.json({ success: true, data: request, message: `Request accepted. ETA: ${request.eta}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/emergency/my
export const getMyRequests = async (req, res) => {
  try {
    const requests = await EmergencyRequest.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/emergency/:id/cancel
export const cancelRequest = async (req, res) => {
  try {
    const request = await EmergencyRequest.findOne({ _id: req.params.id, userId: req.user.id });
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });
    if (request.status !== "pending") {
      return res.status(400).json({ success: false, message: "Cannot cancel a request already in progress" });
    }

    request.status = "cancelled";
    await request.save();
    res.json({ success: true, data: request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/emergency/:id/pay
export const payEmergency = async (req, res) => {
  try {
    const request = await EmergencyRequest.findOne({ _id: req.params.id, userId: req.user.id });
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });
    if (request.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Already paid" });
    }

    const method = req.body.method || 'card'; // 'card' | 'cash'
    request.paymentStatus = method === 'cash' ? 'cash_pending' : 'paid';
    request.paymentId = req.body.paymentId || `pay_${Date.now()}`;
    await request.save();

    // Award 2 loyalty points for every emergency service payment
    await awardLoyaltyPoints(
      request.userId.toString(),
      2,
      `Emergency service reward (${request.serviceType})`
    );

    const message = method === 'cash'
      ? "Cash on delivery confirmed. Pay the provider after work is completed."
      : "Payment confirmed. Emergency service is being dispatched.";

    res.json({ success: true, data: request, message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
