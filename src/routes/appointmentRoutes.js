import express from 'express';
import {
  getAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  getTodayAppointments,
} from '../controllers/appointmentController.js';

const router = express.Router();

//router.use(protect);
router.use((req, res, next) => {
  req.provider = {
    id: 1, // change this to an existing provider id in your DB
  };
  next();
});

router.get('/', getAppointments);
router.get('/today', getTodayAppointments);
router.get('/:id', getAppointmentById);
router.patch('/:id/status', updateAppointmentStatus);

export default router;