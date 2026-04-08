import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createAppReview, getMyAppReviews, getAllAppReviews } from '../controllers/appReviewController.js';

const router = express.Router();

router.get('/',    getAllAppReviews);
router.get('/my',  protect, getMyAppReviews);
router.post('/',   protect, createAppReview);

export default router;
