import express from 'express';
import {
    createBooking,
    getBookingById,
    updatePaymentStatus,
    updateTrackingStatus,
    getUserBookings,
    getProviderBookings,
    providerAction,
} from '../controllers/bookingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createBooking);
router.get('/', protect, getUserBookings);

// ── Provider-specific routes (must be before /:id) ────────────
router.get('/provider/all', protect, getProviderBookings);
router.put('/provider/:id/action', protect, providerAction);

// ── Generic booking routes ────────────────────────────────────
router.get('/:id', protect, getBookingById);
router.put('/:id/payment', protect, updatePaymentStatus);
router.put('/:id/status', protect, updateTrackingStatus);

export default router;
