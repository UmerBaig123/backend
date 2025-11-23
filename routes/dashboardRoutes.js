import express from 'express';
import { getDashboardData, getDashboardChartData } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(requireAuth);

// Get main dashboard data (Total Revenue, Active Projects, Bid Win Rate)
router.get('/data', getDashboardData);

// Get dashboard chart data for additional visualizations
router.get('/charts', getDashboardChartData);

export default router;
