import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
  createBooking, 
  getBookingById, 
  updatePaymentStatus, 
  updateTrackingStatus 
} from '../controllers/bookingController.js';

const router = express.Router();

router.post('/',  createBooking);
router.get('/:id', protect, getBookingById);
router.put('/:id/payment', protect, updatePaymentStatus);
router.put('/:id/status', protect, updateTrackingStatus);

export default router;
