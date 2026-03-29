import express from 'express';
import {
  getRevenueAnalytics,
  getAppointmentAnalytics,
  getServicePopularity,
  getRatingTrend,
  getKpiSummary,
} from '../controllers/analyticsController.js';

const router = express.Router();

//router.use(protect);
router.use((req, res, next) => {
  req.provider = {
    id: 1, // change this to an existing provider id in your DB
  };
  next();
});

router.get('/revenue', getRevenueAnalytics);
router.get('/appointments', getAppointmentAnalytics);
router.get('/service-popularity', getServicePopularity);
router.get('/rating', getRatingTrend);
router.get('/kpi', getKpiSummary);

export default router;