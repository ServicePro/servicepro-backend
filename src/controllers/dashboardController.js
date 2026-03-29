import { pool } from '../config/db.js';

// ─────────────────────────────────────────────────────────────
// @desc    Dashboard summary stats
// @route   GET /api/dashboard/stats
// @access  Private
// ─────────────────────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    const providerId = req.provider.id;
    const today = new Date().toISOString().split('T')[0];
    const firstOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ).toISOString().split('T')[0];

    // Total services
    const [servicesCount] = await pool.execute(
      'SELECT COUNT(*) AS total FROM services WHERE provider_id = ? AND status = "active"',
      [providerId]
    );

    // Today's appointments
    const [todayAppts] = await pool.execute(
      `SELECT COUNT(*) AS total FROM appointments
       WHERE provider_id = ? AND appointment_date = ? AND status != 'cancelled'`,
      [providerId, today]
    );

    // Monthly revenue
    const [monthlyRevenue] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM appointments
       WHERE provider_id = ? AND status = 'completed' AND appointment_date >= ?`,
      [providerId, firstOfMonth]
    );

    // Provider rating
    const [providerInfo] = await pool.execute(
      'SELECT rating, total_reviews FROM providers WHERE id = ?',
      [providerId]
    );

    // Last month's revenue
    const firstOfLastMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() - 1,
      1
    ).toISOString().split('T')[0];

    const [lastMonthRevenue] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM appointments
       WHERE provider_id = ? AND status = 'completed'
         AND appointment_date >= ? AND appointment_date < ?`,
      [providerId, firstOfLastMonth, firstOfMonth]
    );

    // Appointment status breakdown
    const [statusBreakdown] = await pool.execute(
      `SELECT status, COUNT(*) AS count FROM appointments
       WHERE provider_id = ?
       GROUP BY status`,
      [providerId]
    );

    const statusMap = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };

    statusBreakdown.forEach((row) => {
      statusMap[row.status] = row.count;
    });

    // Recent appointments
    const [recentAppointments] = await pool.execute(
      `SELECT a.id, a.client_name, a.appointment_date, a.appointment_time,
              a.amount, a.status, s.name AS service_name
       FROM appointments a
       JOIN services s ON a.service_id = s.id
       WHERE a.provider_id = ?
       ORDER BY a.created_at DESC LIMIT 5`,
      [providerId]
    );

    // Top services by bookings
    const [topServices] = await pool.execute(
      `SELECT s.id, s.name, s.total_bookings,
              COALESCE(SUM(a.amount), 0) AS revenue
       FROM services s
       LEFT JOIN appointments a ON a.service_id = s.id AND a.status = 'completed'
       WHERE s.provider_id = ?
       GROUP BY s.id, s.name, s.total_bookings
       ORDER BY s.total_bookings DESC
       LIMIT 4`,
      [providerId]
    );

    const currentRevenue = parseFloat(monthlyRevenue[0].total);
    const lastRevenue = parseFloat(lastMonthRevenue[0].total);
    const revenueChange =
      lastRevenue > 0
        ? (((currentRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1)
        : 0;

    res.json({
      success: true,
      data: {
        stats: {
          totalServices: servicesCount[0].total,
          todayAppointments: todayAppts[0].total,
          monthlyRevenue: currentRevenue.toFixed(2),
          revenueChange: parseFloat(revenueChange),
          rating: parseFloat(providerInfo[0]?.rating || 0).toFixed(1),
          totalReviews: providerInfo[0]?.total_reviews || 0,
        },
        statusBreakdown: statusMap,
        recentAppointments,
        topServices,
      },
    });
  } catch (error) {
    next(error);
  }
};

export { getDashboardStats };