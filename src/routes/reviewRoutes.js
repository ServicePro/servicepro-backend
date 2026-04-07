import express from 'express';
import {
  createReview,
  getUserReviews,
  getProviderReviews,
  getServiceReviews,
  addProviderResponse,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createReview);
router.get('/my', protect, getUserReviews);
router.get('/provider/:providerId', getProviderReviews);
router.get('/service/:serviceId', getServiceReviews);
router.put('/:id/response', protect, addProviderResponse);

export default router;
