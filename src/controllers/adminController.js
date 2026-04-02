import mongoose from 'mongoose';
import User from '../models/User.js';
import Provider from '../models/Provider.js';
import Appointment from '../models/Appointment.js';

// Get Dashboard Statistics
export const getAdminStats = async (req, res, next) => {
  try {
    // Count total users
    const totalUsers = await User.countDocuments({ role: { $ne: 'admin' } });
    
    // Count active providers
    const activeProviders = await Provider.countDocuments({ status: 'approved' });
    
    // Count pending providers
    const pendingProviders = await Provider.countDocuments({ status: 'pending' });

    // Aggregate total completed revenue
    const revenueStats = await Appointment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
    ]);
    
    const totalRevenue = revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        activeProviders,
        pendingProviders,
        totalRevenue
      }
    });

  } catch (error) {
    next(error);
  }
};

// Get All Users (Consumers & Providers)
export const getAllUsers = async (req, res, next) => {
  try {
    const usersList = await User.find({ role: { $ne: 'admin' } }).select('-password').lean();
    const formattedUsers = usersList.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role || 'user',
      status: u.isVerified ? 'Active' : 'Unverified',
      joined: u.createdAt
    }));

    const providersList = await Provider.find({}).select('-password').lean();
    const formattedProviders = providersList.map(p => ({
      _id: p._id,
      name: p.name,
      email: p.email,
      role: 'provider',
      status: p.status === 'approved' ? 'Active' : (p.status === 'suspended' ? 'Suspended' : 'Pending'),
      joined: p.createdAt
    }));

    // Combine and sort by join date
    const combinedUsers = [...formattedUsers, ...formattedProviders].sort((a, b) => new Date(b.joined) - new Date(a.joined));

    res.json({
      success: true,
      data: {
        users: combinedUsers
      }
    });
  } catch (error) {
    next(error);
  }
};

// Toggle User Status (Suspend/Ban logic simple proxy)
export const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'user' or 'provider'
    
    if (type === 'provider') {
      const provider = await Provider.findById(id);
      if (!provider) return res.status(404).json({ message: "Provider not found" });
      
      provider.status = provider.status === 'approved' ? 'suspended' : 'approved';
      await provider.save();
      return res.json({ success: true, message: `Provider status set to ${provider.status}` });
    } else {
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      // If we use isVerified as a proxy for active status for now
      user.isVerified = !user.isVerified;
      await user.save();
      return res.json({ success: true, message: `User status updated` });
    }
  } catch (error) {
    next(error);
  }
};

// Global Analytics (Bookings over time)
export const getGlobalAnalytics = async (req, res, next) => {
  try {
    // Basic aggregation: count appointments by month
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const appointmentsByMonth = await Appointment.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      { 
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 },
          completed: { 
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const formattedData = appointmentsByMonth.map(item => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      totalAppointments: item.count,
      completedAppointments: item.completed
    }));

    res.json({
      success: true,
      data: {
        trend: formattedData
      }
    });
  } catch (error) {
    next(error);
  }
};
