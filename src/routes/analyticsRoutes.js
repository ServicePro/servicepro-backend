import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getRevenueAnalytics,
  getAppointmentAnalytics,
  getServicePopularity,
  getRatingTrend,
  getKpiSummary,
} from '../controllers/analyticsController.js';

const router = express.Router();

router.use(protect);

router.get('/revenue', getRevenueAnalytics);
router.get('/appointments', getAppointmentAnalytics);
router.get('/service-popularity', getServicePopularity);
router.get('/rating', getRatingTrend);
router.get('/kpi', getKpiSummary);

export default router;