import mongoose from "mongoose";
import User from "../models/User.js";
import Provider from "../models/Provider.js";
import Appointment from "../models/Appointment.js";
import sendEmail from "../utils/sendEmail.js";


// ==============================
// 📊 DASHBOARD STATS
// ==============================
export const getAdminStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments({ role: { $ne: "admin" } });

    const activeProviders = await Provider.countDocuments({ status: "approved" });
    const pendingProviders = await Provider.countDocuments({ status: "pending" });

    const revenueStats = await Appointment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
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


// ==============================
// 👥 ALL USERS + PROVIDERS
// ==============================
export const getAllUsers = async (req, res, next) => {
  try {
    const usersList = await User.find({ role: { $ne: "admin" } })
      .select("-password")
      .lean();

    const formattedUsers = usersList.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role || "user",
      status: u.isVerified ? "Active" : "Unverified",
      joined: u.createdAt
    }));

    const providersList = await Provider.find({})
      .select("-password")
      .lean();

    const formattedProviders = providersList.map((p) => ({
      _id: p._id,
      name: p.name,
      email: p.email,
      role: "provider",
      status:
        p.status === "approved"
          ? "Active"
          : p.status === "suspended"
          ? "Suspended"
          : p.status === "rejected"
          ? "Rejected"
          : "Pending",
      joined: p.createdAt
    }));

    const combinedUsers = [...formattedUsers, ...formattedProviders].sort(
      (a, b) => new Date(b.joined) - new Date(a.joined)
    );

    res.json({
      success: true,
      data: { users: combinedUsers }
    });
  } catch (error) {
    next(error);
  }
};


// ==============================
// 🔄 TOGGLE USER / PROVIDER STATUS
// ==============================
export const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.body;

    if (type === "provider") {
      const provider = await Provider.findById(id);
      if (!provider)
        return res.status(404).json({ message: "Provider not found" });

      provider.status =
        provider.status === "approved" ? "suspended" : "approved";

      await provider.save();

      return res.json({
        success: true,
        message: `Provider status set to ${provider.status}`
      });
    } else {
      const user = await User.findById(id);
      if (!user)
        return res.status(404).json({ message: "User not found" });

      user.isVerified = !user.isVerified;
      await user.save();

      return res.json({
        success: true,
        message: "User status updated"
      });
    }
  } catch (error) {
    next(error);
  }
};


// ==============================
// 📈 GLOBAL ANALYTICS
// ==============================
export const getGlobalAnalytics = async (req, res, next) => {
  try {
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
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0]
            }
          }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const formattedData = appointmentsByMonth.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
      totalAppointments: item.count,
      completedAppointments: item.completed
    }));

    res.json({
      success: true,
      data: { trend: formattedData }
    });
  } catch (error) {
    next(error);
  }
};


// ==============================
// ⏳ GET PENDING PROVIDERS
// ==============================
export const getPendingProviders = async (req, res) => {
  try {
    const providers = await Provider.find({ status: "pending" });
    res.json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// ==============================
// ✅ APPROVE PROVIDER
// ==============================
export const approveProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    provider.status = "approved";
    await provider.save();

    await sendEmail(
      provider.email,
      "ServicePro Account Approved 🎉",
      `
      <h2>Congratulations ${provider.name}!</h2>
      <p>Your account has been approved.</p>
      <a href="${process.env.FRONTEND_URL}/provider-login">
        Click here to login
      </a>
      `
    );

    res.json({
      success: true,
      message: "Provider approved & email sent"
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// ==============================
// ❌ REJECT PROVIDER
// ==============================
export const rejectProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(req.params.id);

    if (!provider) {
      return res.status(404).json({ message: "Provider not found" });
    }

    provider.status = "rejected";
    await provider.save();

    await sendEmail(
      provider.email,
      "ServicePro Application Rejected ❌",
      `
      <h2>Hello ${provider.name}</h2>
      <p>Sorry, your registration was not approved.</p>
      `
    );

    res.json({
      success: true,
      message: "Provider rejected & email sent"
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
