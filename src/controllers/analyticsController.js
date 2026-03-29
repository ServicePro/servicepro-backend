import { pool } from '../config/db.js';

// Revenue analytics
const getRevenueAnalytics = async (req, res, next) => {
  try {
    const providerId = req.provider.id;
    const months = parseInt(req.query.months) || 6;

    const [rows] = await pool.execute(
      `SELECT
         DATE_FORMAT(appointment_date, '%b') AS month,
         DATE_FORMAT(appointment_date, '%Y-%m') AS month_key,
         COALESCE(SUM(amount), 0) AS revenue
       FROM appointments
       WHERE provider_id = ?
         AND status = 'completed'
         AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY month_key, month
       ORDER BY month_key ASC`,
      [providerId, months]
    );

    res.json({ success: true, data: { revenue: rows } });
  } catch (error) {
    next(error);
  }
};

// Appointment analytics
const getAppointmentAnalytics = async (req, res, next) => {
  try {
    const providerId = req.provider.id;
    const months = parseInt(req.query.months) || 6;

    const [rows] = await pool.execute(
      `SELECT
         DATE_FORMAT(appointment_date, '%b')    AS month,
         DATE_FORMAT(appointment_date, '%Y-%m') AS month_key,
         SUM(status = 'completed')  AS completed,
         SUM(status = 'cancelled')  AS cancelled,
         SUM(status = 'pending')    AS pending,
         SUM(status = 'confirmed')  AS confirmed
       FROM appointments
       WHERE provider_id = ?
         AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY month_key, month
       ORDER BY month_key ASC`,
      [providerId, months]
    );

    res.json({ success: true, data: { appointments: rows } });
  } catch (error) {
    next(error);
  }
};

// Service popularity
const getServicePopularity = async (req, res, next) => {
  try {
    const providerId = req.provider.id;

    const [rows] = await pool.execute(
      `SELECT
         s.name,
         s.category,
         COUNT(a.id) AS bookings,
         COALESCE(SUM(a.amount), 0) AS revenue
       FROM services s
       LEFT JOIN appointments a
         ON a.service_id = s.id AND a.status = 'completed'
       WHERE s.provider_id = ?
       GROUP BY s.id, s.name, s.category
       ORDER BY bookings DESC`,
      [providerId]
    );

    res.json({ success: true, data: { servicePopularity: rows } });
  } catch (error) {
    next(error);
  }
};

// Rating trend
const getRatingTrend = async (req, res, next) => {
  try {
    const providerId = req.provider.id;
    const months = parseInt(req.query.months) || 6;

    const [rows] = await pool.execute(
      `SELECT
         DATE_FORMAT(r.created_at, '%b')    AS month,
         DATE_FORMAT(r.created_at, '%Y-%m') AS month_key,
         ROUND(AVG(r.rating), 2)            AS avg_rating
       FROM reviews r
       JOIN services s ON r.service_id = s.id
       WHERE s.provider_id = ?
         AND r.created_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
       GROUP BY month_key, month
       ORDER BY month_key ASC`,
      [providerId, months]
    );

    res.json({ success: true, data: { ratingTrend: rows } });
  } catch (error) {
    next(error);
  }
};

// KPI summary
const getKpiSummary = async (req, res, next) => {
  try {
    const providerId = req.provider.id;
    const months = parseInt(req.query.months) || 6;

    const [revResult] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM appointments
       WHERE provider_id = ? AND status = 'completed'
         AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)`,
      [providerId, months]
    );

    const [apptResult] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM appointments
       WHERE provider_id = ?
         AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)`,
      [providerId, months]
    );

    const [cancelResult] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM appointments
       WHERE provider_id = ? AND status = 'cancelled'
         AND appointment_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)`,
      [providerId, months]
    );

    const [ratingResult] = await pool.execute(
      'SELECT rating, total_reviews FROM providers WHERE id = ?',
      [providerId]
    );

    const totalAppts = parseInt(apptResult[0].total) || 0;
    const cancelledAppts = parseInt(cancelResult[0].total) || 0;

    const cancellationRate =
      totalAppts > 0
        ? ((cancelledAppts / totalAppts) * 100).toFixed(1)
        : '0.0';

    res.json({
      success: true,
      data: {
        kpi: {
          totalRevenue: parseFloat(revResult[0].total).toFixed(2),
          totalAppointments: totalAppts,
          avgRating: parseFloat(ratingResult[0]?.rating || 0).toFixed(1),
          totalReviews: ratingResult[0]?.total_reviews || 0,
          cancellationRate: parseFloat(cancellationRate),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export {
  getRevenueAnalytics,
  getAppointmentAnalytics,
  getServicePopularity,
  getRatingTrend,
  getKpiSummary,
};