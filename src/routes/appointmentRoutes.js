import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  getTodayAppointments,
} from '../controllers/appointmentController.js';

const router = express.Router();

// Apply JWT verification
router.use(protect);

router.get('/', getAppointments);
router.get('/today', getTodayAppointments);
router.get('/:id', getAppointmentById);
router.patch('/:id/status', updateAppointmentStatus);

export default router;