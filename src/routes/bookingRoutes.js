import express from 'express';
import {
    createBooking,
    getBookingById,
    updatePaymentStatus,
    updateTrackingStatus,
    getUserBookings
} from '../controllers/bookingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createBooking);
router.get('/', protect, getUserBookings);
router.get('/:id', protect, getBookingById);
router.put('/:id/payment', protect, updatePaymentStatus);
router.put('/:id/status', protect, updateTrackingStatus);

export default router;
