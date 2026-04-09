import Booking from '../models/Booking.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
import Service from '../models/Service.js';
import Review from '../models/Review.js';
import mongoose from 'mongoose';

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const mkMonthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;

// ── Revenue analytics ─────────────────────────────────────────
const getRevenueAnalytics = async (req, res, next) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);
    const months = parseInt(req.query.months) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Regular bookings revenue (COMPLETED)
    const bookingAgg = await Booking.aggregate([
      { $match: { providerId, status: 'COMPLETED', createdAt: { $gte: startDate } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$amount' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Emergency requests revenue (completed)
    const emAgg = await EmergencyRequest.aggregate([
      { $match: { providerId, status: 'completed', createdAt: { $gte: startDate } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$finalPrice' } } },
    ]);

    // Merge into month map
    const revenueMap = {};
    bookingAgg.forEach(a => {
      const key = mkMonthKey(a._id.year, a._id.month);
      revenueMap[key] = { month_key: key, month: monthNames[a._id.month - 1], revenue: a.revenue };
    });
    emAgg.forEach(a => {
      const key = mkMonthKey(a._id.year, a._id.month);
      if (revenueMap[key]) revenueMap[key].revenue += a.revenue;
      else revenueMap[key] = { month_key: key, month: monthNames[a._id.month - 1], revenue: a.revenue };
    });

    const revenue = Object.values(revenueMap).sort((a, b) => a.month_key.localeCompare(b.month_key));
    res.json({ success: true, data: { revenue } });
  } catch (error) { next(error); }
};

// ── Booking/appointment breakdown analytics ───────────────────
const getAppointmentAnalytics = async (req, res, next) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);
    const months = parseInt(req.query.months) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const agg = await Booking.aggregate([
      { $match: { providerId, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
          pending:   { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } },
          confirmed: { $sum: { $cond: [{ $in: ['$status', ['ACCEPTED', 'ONGOING']] }, 1, 0] } },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const appointments = agg.map(a => ({
      month: monthNames[a._id.month - 1],
      month_key: mkMonthKey(a._id.year, a._id.month),
      completed: a.completed,
      cancelled: a.cancelled,
      pending:   a.pending,
      confirmed: a.confirmed,
    }));

    res.json({ success: true, data: { appointments } });
  } catch (error) { next(error); }
};

// ── Service popularity ────────────────────────────────────────
const getServicePopularity = async (req, res, next) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);

    const agg = await Booking.aggregate([
      { $match: { providerId, status: { $in: ['ACCEPTED', 'ONGOING', 'COMPLETED'] } } },
      { $group: { _id: '$serviceId', bookings: { $sum: 1 }, revenue: { $sum: '$amount' } } },
      { $sort: { bookings: -1 } },
      { $limit: 6 },
    ]);

    const servicePopularity = [];
    for (const a of agg) {
      const service = await Service.findById(a._id).select('name category');
      if (service) {
        servicePopularity.push({ name: service.name, category: service.category, bookings: a.bookings, revenue: a.revenue });
      }
    }

    // Fallback: list provider's services with their stored total_bookings
    if (servicePopularity.length === 0) {
      const services = await Service.find({ providerId }).sort({ total_bookings: -1 }).limit(6);
      services.forEach(s => servicePopularity.push({ name: s.name, bookings: s.total_bookings || 0, revenue: 0 }));
    }

    res.json({ success: true, data: { servicePopularity } });
  } catch (error) { next(error); }
};

// ── Rating trend ──────────────────────────────────────────────
const getRatingTrend = async (req, res, next) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);
    const months = parseInt(req.query.months) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const agg = await Review.aggregate([
      { $match: { providerId, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          avg_rating: { $avg: '$rating' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const ratingTrend = agg.map(a => ({
      month: monthNames[a._id.month - 1],
      month_key: mkMonthKey(a._id.year, a._id.month),
      avg_rating: parseFloat(a.avg_rating.toFixed(2)),
    }));

    res.json({ success: true, data: { ratingTrend } });
  } catch (error) { next(error); }
};

// ── KPI summary ───────────────────────────────────────────────
const getKpiSummary = async (req, res, next) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);
    const months = parseInt(req.query.months) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Revenue: completed bookings + completed emergency requests
    const [bookingRevAgg, emRevAgg] = await Promise.all([
      Booking.aggregate([
        { $match: { providerId, status: 'COMPLETED', createdAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      EmergencyRequest.aggregate([
        { $match: { providerId, status: 'completed', createdAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: '$finalPrice' } } },
      ]),
    ]);
    const totalRevenue = (bookingRevAgg[0]?.total || 0) + (emRevAgg[0]?.total || 0);

    // Total bookings in period
    const [totalBookings, cancelledBookings] = await Promise.all([
      Booking.countDocuments({ providerId, createdAt: { $gte: startDate } }),
      Booking.countDocuments({ providerId, status: 'CANCELLED', createdAt: { $gte: startDate } }),
    ]);

    // Emergency requests in period (accepted ones)
    const totalEmergency = await EmergencyRequest.countDocuments({
      providerId,
      status: { $ne: 'pending' },
      createdAt: { $gte: startDate },
    });

    const totalAll = totalBookings + totalEmergency;
    const cancellationRate = totalBookings > 0
      ? ((cancelledBookings / totalBookings) * 100).toFixed(1)
      : '0.0';

    const ratingAgg = await Review.aggregate([
      { $match: { providerId } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, totalReviews: { $sum: 1 } } },
    ]);

    res.json({
      success: true,
      data: {
        kpi: {
          totalRevenue: totalRevenue.toFixed(2),
          totalAppointments: totalAll,
          avgRating: ratingAgg[0] ? ratingAgg[0].avgRating.toFixed(1) : '4.5',
          totalReviews: ratingAgg[0]?.totalReviews || 0,
          cancellationRate: parseFloat(cancellationRate),
        },
      },
    });
  } catch (error) { next(error); }
};

export {
  getRevenueAnalytics,
  getAppointmentAnalytics,
  getServicePopularity,
  getRatingTrend,
  getKpiSummary,
};
