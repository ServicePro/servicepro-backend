import User from "../models/User.js";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import multer from "multer";

// ── Avatar upload ─────────────────────────────────────────────
const avatarDir = "uploads/users";
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Only JPEG, PNG, or WebP images are allowed."));
  },
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
});

export const uploadAvatarMiddleware = avatarUpload.single("avatar");

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

    res.json({
      success: true,
      data: { user },
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

    user.name    = req.body.name    ?? user.name;
    user.email   = req.body.email   ?? user.email;
    user.phone   = req.body.phone   ?? user.phone;
    user.bio     = req.body.bio     ?? user.bio;
    user.address = req.body.address ?? user.address;
    user.dob     = req.body.dob     ?? user.dob;

    if (req.body.password) {
      const bcrypt = await import("bcryptjs");
      user.password = await bcrypt.default.hash(req.body.password, 10);
    }

    const updatedUser = await user.save();

    res.json({
      success: true,
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        bio: updatedUser.bio,
        address: updatedUser.address,
        dob: updatedUser.dob,
        avatarUrl: updatedUser.avatarUrl,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 📷 Upload Avatar
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete old avatar file if it exists on disk
    if (user.avatarUrl) {
      const oldPath = path.join(".", user.avatarUrl);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarUrl = `/uploads/users/${req.file.filename}`;
    user.avatarUrl = avatarUrl;
    await user.save();

    res.json({ success: true, avatarUrl });
  } catch (error) {
    next(error);
  }
};