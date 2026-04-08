import Review from '../models/Review.js';
import Booking from '../models/Booking.js';

// POST /api/reviews  — user submits a review for a completed booking
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
    const booking = await Booking.findOne({ _id: bookingId, userId: req.user.id, status: { $in: ['ACCEPTED', 'ONGOING', 'COMPLETED'] } });
    if (!booking) {
      return res.status(400).json({ success: false, message: 'Booking not found.' });
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

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

// GET /api/reviews/my  — get all reviews by the current user
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

// GET /api/reviews/provider/:providerId  — public, get reviews for a provider
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

// GET /api/reviews/service/:serviceId  — public, get all reviews for a service
export const getServiceReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ serviceId: req.params.serviceId })
      .populate('clientId', 'name')
      .populate('providerId', 'name')
      .sort({ createdAt: -1 });

    const avg = reviews.length
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    res.json({ success: true, data: reviews, averageRating: avg ? Number(avg) : null, total: reviews.length });
  } catch (error) {
    next(error);
  }
};

// PUT /api/reviews/:id/response  — provider adds a response to a review
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
