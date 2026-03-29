import express from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';

const router = express.Router();

//router.use(protect);
router.use((req, res, next) => {
  req.provider = {
    id: 1, // change this to an existing provider id in your DB
  };
  next();
});

router.get('/stats', getDashboardStats);

export default router;