import Service from '../models/Service.js';
import Appointment from '../models/Appointment.js';
import Review from '../models/Review.js';
import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────
// @desc    Dashboard summary stats
// @route   GET /api/dashboard/stats
// @access  Private
// ─────────────────────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    const providerId = req.user.id;
    const providerObjectId = new mongoose.Types.ObjectId(providerId);

    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);

    const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // Total services
    const servicesCount = await Service.countDocuments({ providerId, status: 'active' });

    // Today's appointments
    const todayAppts = await Appointment.countDocuments({
      providerId,
      appointment_date: { $gte: todayDate, $lt: tomorrowDate },
      status: { $ne: 'cancelled' }
    });

    // Monthly revenue
    const monthlyRevAgg = await Appointment.aggregate([
      { $match: { providerId: providerObjectId, status: 'completed', appointment_date: { $gte: firstOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const currentRevenue = monthlyRevAgg.length > 0 ? monthlyRevAgg[0].total : 0;

    // Last month's revenue
    const firstOfLastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const lastMonthRevAgg = await Appointment.aggregate([
      { $match: { 
          providerId: providerObjectId, 
          status: 'completed', 
          appointment_date: { $gte: firstOfLastMonth, $lt: firstOfMonth } 
        } 
      },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const lastRevenue = lastMonthRevAgg.length > 0 ? lastMonthRevAgg[0].total : 0;

    // Provider rating (calculated dynamically from reviews or static for prototype)
    const ratingAgg = await Review.aggregate([
      { $match: { providerId: providerObjectId } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } }
    ]);

    const avgRating = ratingAgg.length > 0 ? ratingAgg[0].avgRating.toFixed(1) : "4.5";
    const totalReviews = ratingAgg.length > 0 ? ratingAgg[0].totalReviews : 0;

    // Appointment status breakdown
    const statusBreakdownAgg = await Appointment.aggregate([
      { $match: { providerId: providerObjectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const statusMap = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    statusBreakdownAgg.forEach(row => {
      statusMap[row._id] = row.count;
    });

    // Recent appointments
    const recentAppointmentsDocs = await Appointment.find({ providerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('serviceId', 'name');

    const recentAppointments = recentAppointmentsDocs.map(doc => {
      const obj = doc.toObject();
      return {
        id: obj._id,
        client_name: obj.client_name,
        appointment_date: obj.appointment_date,
        appointment_time: obj.appointment_time,
        amount: obj.amount,
        status: obj.status,
        service_name: obj.serviceId ? obj.serviceId.name : 'Unknown'
      };
    });

    // Top services by bookings
    const topServicesDocs = await Service.find({ providerId })
      .sort({ total_bookings: -1 })
      .limit(4);

    const topServices = topServicesDocs.map(s => ({
      id: s._id,
      name: s.name,
      total_bookings: s.total_bookings,
      revenue: s.total_bookings * s.price // Rough estimate, or use aggregate for exact
    }));

    const revenueChange = lastRevenue > 0
      ? (((currentRevenue - lastRevenue) / lastRevenue) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        stats: {
          totalServices: servicesCount,
          todayAppointments: todayAppts,
          monthlyRevenue: currentRevenue.toFixed(2),
          revenueChange: parseFloat(revenueChange),
          rating: avgRating,
          totalReviews
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