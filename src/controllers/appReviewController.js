import AppReview from '../models/AppReview.js';

// POST /api/app-reviews  — submit a review about the ServicePro app
export const createAppReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || !comment?.trim()) {
      return res.status(400).json({ success: false, message: 'Rating and comment are required.' });
    }

    const review = await AppReview.create({
      userId:   req.user.id,
      userName: req.user.name || 'User',
      rating:   Number(rating),
      comment:  comment.trim(),
    });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
};

// GET /api/app-reviews/my  — current user's own app reviews
export const getMyAppReviews = async (req, res, next) => {
  try {
    const reviews = await AppReview.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
};

// GET /api/app-reviews  — public: all app reviews (latest 100)
export const getAllAppReviews = async (req, res, next) => {
  try {
    const reviews = await AppReview.find()
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: reviews });
  } catch (err) {
    next(err);
  }
};
