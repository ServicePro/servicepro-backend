import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Service from '../models/Service.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import User from '../models/User.js';

// Helper: recompute and persist a service's average rating
async function refreshServiceRating(serviceId) {
  if (!serviceId) return;
  try {
    const reviews = await Review.find({ serviceId });
    if (reviews.length === 0) return;
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    await Service.findByIdAndUpdate(serviceId, {
      rating: Math.round(avg * 10) / 10,
      reviews_count: reviews.length,
    });
  } catch { /* non-critical */ }
}

// POST /api/reviews  â€” user submits a review for a completed booking
export const createReview = async (req, res, next) => {
  try {
    if (req.user.role !== 'user') {
      return res.status(403).json({ success: false, message: 'Only users can submit reviews.' });
    }

    const { providerId, serviceId, bookingId, rating, comment } = req.body;

    if (!providerId || !serviceId || !rating) {
      return res.status(400).json({ success: false, message: 'providerId, serviceId, and rating are required.' });
    }

    // Verify the booking belongs to this user and is in a reviewable state
    const booking = await Booking.findOne({ _id: bookingId, userId: req.user.id, status: 'COMPLETED' });
    if (!booking) {
      return res.status(400).json({ success: false, message: 'Only completed bookings can be reviewed.' });
    }

    // Prevent duplicate review for same booking
    const existing = await Review.findOne({ bookingId, clientId: req.user.id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this booking.' });
    }

    const review = await Review.create({
      providerId,
      serviceId,
      bookingId,
      clientId: req.user.id,
      rating,
      comment,
    });

    // Keep the service's cached rating field up to date
    await refreshServiceRating(serviceId);

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

// GET /api/reviews/my  â€” get all reviews by the current user
export const getUserReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ clientId: req.user.id })
      .populate('providerId', 'name')
      .populate('serviceId', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

// GET /api/reviews/provider/:providerId  â€” public, get reviews for a provider
export const getProviderReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ providerId: req.params.providerId })
      .populate('clientId', 'name')
      .populate('serviceId', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

// GET /api/reviews/service/:serviceId — public, get all reviews for a service
export const getServiceReviews = async (req, res, next) => {
  try {
    const svc = await Service.findById(req.params.serviceId).select('providerId category rating').lean();

    // Step 1: Review docs directly linked to this service
    const directReviews = await Review.find({ serviceId: req.params.serviceId })
      .populate('clientId', 'name')
      .populate('providerId', 'name')
      .sort({ createdAt: -1 });

    // Step 2: Review docs with serviceId=null for the same provider
    let nullServiceReviews = [];
    if (svc?.providerId) {
      nullServiceReviews = await Review.find({
        providerId: svc.providerId,
        serviceId: null,
        bookingId: null,
      })
        .populate('clientId', 'name')
        .populate('providerId', 'name')
        .lean();
    }

    // IDs of EmergencyRequests already covered by a Review doc (via bookingId),
    // prevents double-counting once Review docs start getting created.
    const coveredEmIds = new Set(
      [...directReviews, ...nullServiceReviews]
        .map(r => (r.bookingId ? String(r.bookingId) : null))
        .filter(Boolean)
    );

    // Step 3: EmergencyRequest fallback for ratings submitted while backend was offline
    let emergencyRatings = [];
    if (svc?.providerId) {
      const emReqs = await EmergencyRequest.find({
        providerId: svc.providerId,
        status: 'completed',
        userRating: { $ne: null },
      })
        .populate('userId', 'name')
        .lean();

      emergencyRatings = emReqs
        .filter(em => !coveredEmIds.has(String(em._id)))
        .map(em => ({
          _id: `em_${em._id}`,
          providerId: { _id: em.providerId, name: '' },
          clientId: { _id: em.userId?._id, name: em.userId?.name || 'User' },
          bookingId: null,
          rating: em.userRating,
          comment: em.userComment || null,
          providerResponse: null,
          createdAt: em.updatedAt || em.createdAt,
          isEmergency: true,
        }));
    }

    // Merge, deduplicate by _id, sort newest-first
    const seen = new Set();
    const reviews = [...directReviews, ...nullServiceReviews, ...emergencyRatings]
      .filter(r => {
        const key = String(r._id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const avg = reviews.length
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

    // Sync Service.rating so listing cards show the real average (fire-and-forget)
    if (svc) {
      Service.findByIdAndUpdate(req.params.serviceId, {
        rating: avg !== null ? Math.round(avg * 10) / 10 : svc.rating,
        reviews_count: reviews.length,
      }).catch(() => {});
    }

    res.json({
      success: true,
      data: reviews,
      averageRating: avg !== null ? Math.round(avg * 10) / 10 : null,
      total: reviews.length,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/reviews/:id/response  â€” provider adds a response to a review
export const addProviderResponse = async (req, res, next) => {
  try {
    if (req.user.role !== 'provider') {
      return res.status(403).json({ success: false, message: 'Only providers can respond to reviews.' });
    }

    const { response } = req.body;
    if (!response?.trim()) {
      return res.status(400).json({ success: false, message: 'Response text is required.' });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    if (review.providerId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorised to respond to this review.' });
    }

    review.providerResponse = response.trim();
    await review.save();
    res.json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};
