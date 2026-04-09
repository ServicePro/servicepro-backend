import EmergencyRequest from "../models/EmergencyRequest.js";
import Review from "../models/Review.js";
import Service from "../models/Service.js";
import { awardLoyaltyPoints } from "./subscriptionController.js";

const EMERGENCY_SERVICES = [
  { id: "cleaning",       label: "Cleaning Services",      basePrice: 60,  icon: "🧹" },
  { id: "beauty_wellness",label: "Beauty & Wellness",       basePrice: 70,  icon: "✨" },
  { id: "electrical",     label: "Electrical Services",     basePrice: 100, icon: "⚡" },
  { id: "plumbing",       label: "Plumbing Services",       basePrice: 80,  icon: "🔧" },
  { id: "painting",       label: "Painting Services",       basePrice: 70,  icon: "🎨" },
  { id: "home_repair",    label: "Repair Services",         basePrice: 85,  icon: "🛠️" },
  { id: "tutoring",       label: "Tutoring Services",       basePrice: 50,  icon: "📚" },
  { id: "health_fitness", label: "Health and Fitness",      basePrice: 60,  icon: "🏋️" },
  { id: "childcare",      label: "Childcare Services",      basePrice: 55,  icon: "🧸" },
  { id: "cooking",        label: "Cooking Services",        basePrice: 65,  icon: "👨‍🍳" },
  { id: "elderly_care",   label: "Elderly Care Services",   basePrice: 60,  icon: "❤️" },
  { id: "laundry",        label: "Laundry Services",        basePrice: 45,  icon: "🧺" },
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
      cleaning:        ['Cleaning'],
      beauty_wellness: ['Beauty & Wellness'],
      electrical:      ['Electrical'],
      plumbing:        ['Plumbing'],
      painting:        ['Painting'],
      home_repair:     ['Home Repair'],
      tutoring:        ['Tutoring'],
      health_fitness:  ['Health and Fitness'],
      childcare:       ['Childcare'],
      cooking:         ['Cooking'],
      elderly_care:    ['Elderly Care'],
      laundry:         ['Laundry'],
      // legacy / fallback
      pest:        ['Cleaning'],
      hvac:        ['Home Repair'],
      carpentry:   ['Home Repair'],
      landscaping: ['Home Repair'],
      moving:      ['Home Repair'],
      general:     ['Plumbing','Electrical','Home Repair','Cleaning','Painting','Beauty & Wellness','Tutoring','Health and Fitness','Childcare','Cooking','Elderly Care','Laundry'],
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
    const requests = await EmergencyRequest.find({ userId: req.user.id })
      .populate('providerId', 'name profile_image rating category area')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// serviceType → DB category mapping (mirrors EMERGENCY_SERVICES above)
const SERVICE_TYPE_TO_CATEGORY = {
  cleaning:        'Cleaning',
  beauty_wellness: 'Beauty & Wellness',
  electrical:      'Electrical',
  plumbing:        'Plumbing',
  painting:        'Painting',
  home_repair:     'Home Repair',
  tutoring:        'Tutoring',
  health_fitness:  'Health and Fitness',
  childcare:       'Childcare',
  cooking:         'Cooking',
  elderly_care:    'Elderly Care',
  laundry:         'Laundry',
};

// PATCH /api/emergency/:id/rate  (user rates a completed emergency)
export const rateRequest = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be 1–5.' });
    }
    const request = await EmergencyRequest.findOne({ _id: req.params.id, userId: req.user.id, status: 'completed' });
    if (!request) return res.status(404).json({ success: false, message: 'Completed emergency request not found.' });
    if (request.userRating) return res.status(400).json({ success: false, message: 'Already rated.' });
    request.userRating = rating;
    request.userComment = comment?.trim() || null;
    await request.save();

    // Persist a Review doc linked to the provider's MATCHING service
    // so it shows on that specific service's detail page (not on all services)
    if (request.providerId) {
      const alreadyReviewed = await Review.findOne({
        clientId: req.user.id,
        providerId: request.providerId,
        bookingId: null,
      });
      if (!alreadyReviewed) {
        // Find the provider's active service that matches this emergency type
        const matchCategory = SERVICE_TYPE_TO_CATEGORY[request.serviceType] || null;
        let matchedServiceId = null;
        if (matchCategory) {
          const matchedService = await Service.findOne({
            providerId: request.providerId,
            category: { $regex: matchCategory, $options: 'i' },
            status: 'active',
          }).lean();
          matchedServiceId = matchedService?._id || null;
        }

        const createdReview = await Review.create({
          providerId: request.providerId,
          clientId: req.user.id,
          serviceId: matchedServiceId,   // linked to specific service (or null if none found)
          bookingId: request._id,        // cross-reference so getServiceReviews can deduplicate
          rating,
          comment: comment?.trim() || null,
        });

        // Update the service's cached rating if we found a match
        if (matchedServiceId) {
          const allRevs = await Review.find({ serviceId: matchedServiceId });
          const avg = allRevs.reduce((s, r) => s + r.rating, 0) / allRevs.length;
          await Service.findByIdAndUpdate(matchedServiceId, {
            rating: Math.round(avg * 10) / 10,
            reviews_count: allRevs.length,
          });
        }
      }
    }

    res.json({ success: true, data: request });
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

// PATCH /api/emergency/:id/complete  (provider marks completed)
export const completeRequest = async (req, res) => {
  try {
    const request = await EmergencyRequest.findOne({
      _id: req.params.id,
      providerId: req.user.id,
      status: { $in: ['assigned', 'en_route'] },
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found or not in accepted state' });
    request.status = 'completed';
    await request.save();
    res.json({ success: true, data: request, message: 'Emergency request marked as completed.' });
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
