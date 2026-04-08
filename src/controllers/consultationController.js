import Consultation from "../models/Consultation.js";
import Service from "../models/Service.js";
import Provider from "../models/Provider.js";

// POST /api/consultations
export const scheduleSession = async (req, res) => {
  try {
    const { providerId, serviceId, topic, scheduledAt, duration, notes } = req.body;
    if (!providerId || !topic || !scheduledAt) {
      return res.status(400).json({ success: false, message: "providerId, topic, scheduledAt are required" });
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ success: false, message: "Scheduled time must be in the future" });
    }

    const sessionData = {
      userId: req.user.id,
      providerId,
      topic,
      scheduledAt: scheduledDate,
      duration: duration || 30,
      notes,
    };
    if (serviceId) sessionData.serviceId = serviceId;

    const session = await Consultation.create(sessionData);

    const populated = await Consultation.findById(session._id)
      .populate('providerId', 'name email phone category')
      .populate('serviceId',  'name category')
      .populate('userId',     'name email');
    res.status(201).json({ success: true, data: populated, message: 'Session scheduled! Waiting for provider confirmation.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/consultations/my  (user)
export const getMySessions = async (req, res) => {
  try {
    const sessions = await Consultation.find({ userId: req.user.id })
      .populate('providerId', 'name email phone category')
      .populate('serviceId',  'name category')
      .populate('userId',     'name email')
      .sort({ scheduledAt: 1 });
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/consultations/provider  (provider inbox)
export const getProviderSessions = async (req, res) => {
  try {
    const provider = await Provider.findById(req.user.id);
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found' });

    const sessions = await Consultation.find({ providerId: provider._id })
      .populate('providerId', 'name email phone category')
      .populate('serviceId',  'name category')
      .populate('userId',     'name email')
      .sort({ scheduledAt: 1 });
    res.json({ success: true, data: sessions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/consultations/:id/accept  (provider accepts — generates Jitsi meet link)
export const acceptSession = async (req, res) => {
  try {
    const provider = await Provider.findById(req.user.id);
    if (!provider) return res.status(403).json({ success: false, message: "Not a provider" });

    const session = await Consultation.findOne({ _id: req.params.id, providerId: provider._id });
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });
    if (!["pending", "rescheduled"].includes(session.providerStatus)) {
      return res.status(400).json({ success: false, message: "Session already processed" });
    }

    session.providerStatus = "accepted";
    session.meetLink = `https://meet.jit.si/servicepro-${session.roomId || session._id}`;
    if (!session.roomId) session.roomId = `sp-room-${session._id}`;
    await session.save();

    const populated = await Consultation.findById(session._id)
      .populate('providerId', 'name email phone category')
      .populate('serviceId',  'name category')
      .populate('userId',     'name email');
    res.json({ success: true, data: populated, message: 'Session accepted. Meet link generated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/consultations/:id/reschedule  (provider proposes new time)
export const rescheduleSession = async (req, res) => {
  try {
    const provider = await Provider.findById(req.user.id);
    if (!provider) return res.status(403).json({ success: false, message: "Not a provider" });

    const { proposedAt } = req.body;
    if (!proposedAt) return res.status(400).json({ success: false, message: "proposedAt is required" });

    const proposedDate = new Date(proposedAt);
    if (proposedDate <= new Date()) {
      return res.status(400).json({ success: false, message: "Proposed time must be in the future" });
    }

    const session = await Consultation.findOne({ _id: req.params.id, providerId: provider._id });
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    session.providerStatus = "rescheduled";
    session.proposedAt = proposedDate;
    await session.save();

    const populated = await Consultation.findById(session._id)
      .populate('providerId', 'name email phone category')
      .populate('serviceId',  'name category')
      .populate('userId',     'name email');
    res.json({ success: true, data: populated, message: 'New time proposed to user.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/consultations/:id/confirm  (user confirms provider's proposed time)
export const confirmReschedule = async (req, res) => {
  try {
    const session = await Consultation.findOne({ _id: req.params.id, userId: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });
    if (session.providerStatus !== "rescheduled" || !session.proposedAt) {
      return res.status(400).json({ success: false, message: "No rescheduled time to confirm" });
    }

    session.scheduledAt = session.proposedAt;
    session.proposedAt = undefined;
    session.providerStatus = "accepted";
    session.meetLink = `https://meet.jit.si/servicepro-${session.roomId || session._id}`;
    if (!session.roomId) session.roomId = `sp-room-${session._id}`;
    await session.save();

    const populated = await Consultation.findById(session._id)
      .populate('providerId', 'name email phone category')
      .populate('serviceId',  'name category')
      .populate('userId',     'name email');
    res.json({ success: true, data: populated, message: 'Reschedule confirmed. Meet link ready.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/consultations/:id/cancel
export const cancelSession = async (req, res) => {
  try {
    const session = await Consultation.findOne({ _id: req.params.id, userId: req.user.id });
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });
    if (session.status !== "scheduled") {
      return res.status(400).json({ success: false, message: "Cannot cancel this session" });
    }
    session.status = "cancelled";
    await session.save();
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/consultations/providers?category=Plumbing
export const getAvailableProviders = async (req, res) => {
  try {
    const filter = { status: 'approved', is_active: true };
    if (req.query.category) filter.category = req.query.category;
    const providers = await Provider.find(filter, "name email phone category");
    res.json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/consultations/services
export const getAvailableServices = async (req, res) => {
  try {
    const services = await Service.find({ isActive: { $ne: false } }, "name category price");
    res.json({ success: true, data: services });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
