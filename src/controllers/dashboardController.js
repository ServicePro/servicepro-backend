import Service from '../models/Service.js';
import Appointment from '../models/Appointment.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import EmergencyRequest from '../models/EmergencyRequest.js';
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

    // Today's appointments (regular)
    const todayAppts = await Appointment.countDocuments({
      providerId,
      appointment_date: { $gte: todayDate, $lt: tomorrowDate },
      status: { $ne: 'cancelled' }
    });

    // Today's emergency requests assigned to this provider
    const todayEmergency = await EmergencyRequest.countDocuments({
      providerId: providerObjectId,
      createdAt: { $gte: todayDate, $lt: tomorrowDate },
      status: { $nin: ['cancelled', 'pending'] },
    });

    // Monthly revenue (regular bookings)
    const monthlyRevAgg = await Appointment.aggregate([
      { $match: { providerId: providerObjectId, status: 'completed', appointment_date: { $gte: firstOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const apptRevenue = monthlyRevAgg.length > 0 ? monthlyRevAgg[0].total : 0;

    // Monthly revenue (emergency bookings)
    const emRevAgg = await EmergencyRequest.aggregate([
      { $match: { providerId: providerObjectId, status: 'completed', createdAt: { $gte: firstOfMonth } } },
      { $group: { _id: null, total: { $sum: '$finalPrice' } } },
    ]);
    const emRevenue = emRevAgg.length > 0 ? emRevAgg[0].total : 0;
    const currentRevenue = apptRevenue + emRevenue;

    // Last month's revenue (regular)
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
    const lastApptRevenue = lastMonthRevAgg.length > 0 ? lastMonthRevAgg[0].total : 0;

    // Last month's revenue (emergency)
    const lastEmRevAgg = await EmergencyRequest.aggregate([
      { $match: { providerId: providerObjectId, status: 'completed', createdAt: { $gte: firstOfLastMonth, $lt: firstOfMonth } } },
      { $group: { _id: null, total: { $sum: '$finalPrice' } } },
    ]);
    const lastRevenue = lastApptRevenue + (lastEmRevAgg.length > 0 ? lastEmRevAgg[0].total : 0);

    // Provider rating (calculated dynamically from reviews or static for prototype)
    const ratingAgg = await Review.aggregate([
      { $match: { providerId: providerObjectId } },
      { $group: { _id: null, avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } }
    ]);

    const avgRating = ratingAgg.length > 0 ? ratingAgg[0].avgRating.toFixed(1) : "4.5";
    const totalReviews = ratingAgg.length > 0 ? ratingAgg[0].totalReviews : 0;

    // Booking status breakdown (from Booking model — PENDING/ACCEPTED/ONGOING/COMPLETED/CANCELLED)
    const bookingStatusAgg = await Booking.aggregate([
      { $match: { providerId: providerObjectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Map Booking uppercase statuses → display keys
    const statusMap = {
      pending:   0,
      confirmed: 0,
      ongoing:   0,
      completed: 0,
      cancelled: 0,
      emergency: 0,
    };
    const bookingStatusMap = { PENDING: 'pending', ACCEPTED: 'confirmed', ONGOING: 'ongoing', COMPLETED: 'completed', CANCELLED: 'cancelled' };
    bookingStatusAgg.forEach(row => {
      const key = bookingStatusMap[row._id];
      if (key) statusMap[key] = row.count;
    });

    // Emergency request counts (assigned + en_route + completed)
    const emStatusAgg = await EmergencyRequest.aggregate([
      { $match: { providerId: providerObjectId, status: { $ne: 'pending' } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    let emergencyTotal = 0;
    emStatusAgg.forEach(row => { emergencyTotal += row.count; });
    statusMap.emergency = emergencyTotal;

    // Recent bookings (from Booking model)
    const recentBookingDocs = await Booking.find({ providerId: providerObjectId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('serviceId', 'name')
      .populate('userId', 'name');

    const recentApptRows = recentBookingDocs.map(doc => {
      const obj = doc.toObject();
      const statusLabel = bookingStatusMap[obj.status] || obj.status.toLowerCase();
      return {
        id: obj._id,
        client_name: obj.userId?.name || 'Customer',
        appointment_date: obj.scheduledDate || obj.date,
        appointment_time: obj.scheduledTime || obj.time || '',
        amount: obj.amount,
        status: statusLabel,
        service_name: obj.serviceId?.name || 'Service',
        type: 'booking',
      };
    });

    // Recent emergency requests assigned to this provider
    const recentEmDocs = await EmergencyRequest.find({
      providerId: providerObjectId,
      status: { $ne: 'pending' },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name');

    const formatType = (t) =>
      t?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Emergency Service';

    const recentEmRows = recentEmDocs.map(doc => {
      const obj = doc.toObject();
      const emStatus = obj.status === 'assigned' || obj.status === 'en_route' ? 'confirmed' : obj.status;
      return {
        id: obj._id,
        client_name: obj.userId?.name || 'Customer',
        appointment_date: obj.createdAt,
        appointment_time: new Date(obj.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        amount: obj.finalPrice,
        status: emStatus,
        service_name: '🚨 ' + formatType(obj.serviceType),
        type: 'emergency',
      };
    });

    // Merge and sort by date, keep top 8
    const recentAppointments = [...recentApptRows, ...recentEmRows]
      .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))
      .slice(0, 8);

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
          todayAppointments: todayAppts + todayEmergency,
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