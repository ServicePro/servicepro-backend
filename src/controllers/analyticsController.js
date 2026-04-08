import Appointment from '../models/Appointment.js';
import Service from '../models/Service.js';
import Review from '../models/Review.js';
import mongoose from 'mongoose';

// Helper for month names
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Revenue analytics
const getRevenueAnalytics = async (req, res, next) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);
    const months = parseInt(req.query.months) || 6;
    
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const agg = await Appointment.aggregate([
      { $match: { providerId, status: 'completed', appointment_date: { $gte: startDate } } },
      { 
        $group: {
          _id: {
            year: { $year: "$appointment_date" },
            month: { $month: "$appointment_date" }
          },
          revenue: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const revenue = agg.map(a => {
      const monthStr = `${a._id.year}-${String(a._id.month).padStart(2, '0')}`;
      return {
        month: monthNames[a._id.month - 1],
        month_key: monthStr,
        revenue: a.revenue
      };
    });

    res.json({ success: true, data: { revenue } });
  } catch (error) {
    next(error);
  }
};

// Appointment analytics
const getAppointmentAnalytics = async (req, res, next) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);
    const months = parseInt(req.query.months) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const agg = await Appointment.aggregate([
      { $match: { providerId, appointment_date: { $gte: startDate } } },
      { 
        $group: {
          _id: {
            year: { $year: "$appointment_date" },
            month: { $month: "$appointment_date" }
          },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          confirmed: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const appointments = agg.map(a => {
      const monthStr = `${a._id.year}-${String(a._id.month).padStart(2, '0')}`;
      return {
        month: monthNames[a._id.month - 1],
        month_key: monthStr,
        ...a
      };
    });

    res.json({ success: true, data: { appointments } });
  } catch (error) {
    next(error);
  }
};

// Service popularity
const getServicePopularity = async (req, res, next) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);

    // Aggregate appointments to get counts
    const agg = await Appointment.aggregate([
      { $match: { providerId, status: 'completed' } },
      { $group: { _id: "$serviceId", bookings: { $sum: 1 }, revenue: { $sum: "$amount" } } }
    ]);

    const servicePopularity = [];
    for (const a of agg) {
      const service = await Service.findById(a._id);
      if (service) {
        servicePopularity.push({
          name: service.name,
          category: service.category,
          bookings: a.bookings,
          revenue: a.revenue
        });
      }
    }
    
    // Fallback if no appointments yet
    if (servicePopularity.length === 0) {
      const services = await Service.find({ providerId }).limit(6);
      services.forEach(s => servicePopularity.push({ name: s.name, bookings: s.total_bookings }));
    }

    servicePopularity.sort((a, b) => b.bookings - a.bookings);

    res.json({ success: true, data: { servicePopularity: servicePopularity.slice(0, 6) } });
  } catch (error) {
    next(error);
  }
};

// Rating trend
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
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          avg_rating: { $avg: "$rating" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const ratingTrend = agg.map(a => {
      const monthStr = `${a._id.year}-${String(a._id.month).padStart(2, '0')}`;
      return {
        month: monthNames[a._id.month - 1],
        month_key: monthStr,
        avg_rating: parseFloat(a.avg_rating.toFixed(2))
      };
    });

    res.json({ success: true, data: { ratingTrend } });
  } catch (error) {
    next(error);
  }
};

// KPI summary
const getKpiSummary = async (req, res, next) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);
    const months = parseInt(req.query.months) || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const revAgg = await Appointment.aggregate([
      { $match: { providerId, status: 'completed', appointment_date: { $gte: startDate } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    const apptAgg = await Appointment.countDocuments({
      providerId, appointment_date: { $gte: startDate }
    });

    const cancelAgg = await Appointment.countDocuments({
      providerId, status: 'cancelled', appointment_date: { $gte: startDate }
    });

    const ratingAgg = await Review.aggregate([
      { $match: { providerId } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } }
    ]);

    const totalAppts = apptAgg || 0;
    const cancelledAppts = cancelAgg || 0;
    const cancellationRate = totalAppts > 0 ? ((cancelledAppts / totalAppts) * 100).toFixed(1) : '0.0';

    res.json({
      success: true,
      data: {
        kpi: {
          totalRevenue: revAgg.length > 0 ? parseFloat(revAgg[0].total).toFixed(2) : "0.00",
          totalAppointments: totalAppts,
          avgRating: ratingAgg.length > 0 ? ratingAgg[0].avgRating.toFixed(1) : "4.5",
          totalReviews: ratingAgg.length > 0 ? ratingAgg[0].totalReviews : 0,
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