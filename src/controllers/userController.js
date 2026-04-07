import jwt from "jsonwebtoken";
import Booking from "../models/Booking.js";
import User from "../models/User.js";

const serializeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone || "",
  role: user.role,
  avatar_url: user.avatar_url || null,
  isVerified: user.isVerified,
});

// 🔐 Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// 📝 Register User
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

// 🔑 Login User
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          token: generateToken(user._id),
        },
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    next(error);
  }
};

// 👤 Get Profile
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      data: { user: serializeUser(user) },
    });
  } catch (error) {
    next(error);
  }
};

// 🔔 Get user notifications derived from provider booking updates
export const getUserNotifications = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .populate("serviceId", "name")
      .populate("providerId", "name")
      .sort({ updatedAt: -1 })
      .limit(12);

    const notifications = bookings.map((booking) => {
      const providerName = booking.providerId?.name || "Your provider";
      const serviceName = booking.serviceId?.name || "service";
      const status = booking.status || "PENDING";

      let message = `${providerName} sent an update about your ${serviceName} booking.`;
      let type = "info";

      if (status === "ACCEPTED") {
        message = `${providerName} accepted your booking for ${serviceName}.`;
        type = "success";
      } else if (status === "ONGOING") {
        message = `${providerName} has started working on your ${serviceName} request.`;
        type = "info";
      } else if (status === "COMPLETED") {
        message = `${providerName} marked your ${serviceName} service as completed.`;
        type = "success";
      } else if (status === "CANCELLED") {
        message = `${providerName} cancelled your ${serviceName} booking.`;
        type = "warning";
      } else if (status === "PENDING") {
        message = `Your ${serviceName} booking is pending provider confirmation.`;
        type = "info";
      }

      return {
        id: booking._id,
        bookingId: booking._id,
        status,
        type,
        providerName,
        serviceName,
        message,
        createdAt: booking.updatedAt || booking.createdAt,
      };
    });

    res.json({
      success: true,
      data: { notifications },
    });
  } catch (error) {
    next(error);
  }
};

// ✏️ Update Profile
export const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const nextEmail = req.body.email?.trim()?.toLowerCase();

    if (nextEmail && nextEmail !== user.email) {
      const existingUser = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({ message: "Email is already in use." });
      }
      user.email = nextEmail;
    }

    user.name = req.body.name?.trim() || user.name;
    user.phone = req.body.phone?.trim?.() ?? user.phone;

    if (req.file) {
      user.avatar_url = `/uploads/users/${req.file.filename}`;
    }

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      success: true,
      data: { user: serializeUser(updatedUser) },
    });
  } catch (error) {
    next(error);
  }
};