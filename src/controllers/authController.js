import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Provider from '../models/Provider.js';

// ── Helper: generate JWT ──────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'servicepro_super_secret_jwt_key_change_in_production', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Register
const register = async (req, res, next) => {
  try {
    const { name, email, password, phone, category, bio } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    const existing = await Provider.findOne({ email });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const provider = new Provider({
      name,
      email,
      password: hashedPassword,
      phone,
      category,
      bio,
    });

    await provider.save();

    const providerData = provider.toObject();
    delete providerData.password;
    providerData.id = providerData._id;

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        provider: providerData,
        token: generateToken(provider._id),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email is already registered.' });
    }
    next(error);
  }
};

// Login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const provider = await Provider.findOne({ email, is_active: true });

    if (!provider) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials or account deactivated.',
      });
    }

    const isMatch = await bcrypt.compare(password, provider.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const providerData = provider.toObject();
    delete providerData.password;
    providerData.id = providerData._id;

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        provider: providerData,
        token: generateToken(provider._id),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get profile
const getMe = async (req, res, next) => {
  try {
    const provider = await Provider.findById(req.user.id).select('-password');
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found.' });
    }

    const providerData = provider.toObject();
    providerData.id = providerData._id;

    res.json({ success: true, data: { provider: providerData } });
  } catch (error) {
    next(error);
  }
};

// Update profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, category, bio } = req.body;

    const provider = await Provider.findById(req.user.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found.' });
    }

    if (name) provider.name = name;
    if (phone) provider.phone = phone;
    if (category) provider.category = category;
    if (bio) provider.bio = bio;

    await provider.save();

    const providerData = provider.toObject();
    delete providerData.password;
    providerData.id = providerData._id;

    res.json({
      success: true,
      message: 'Profile updated.',
      data: { provider: providerData },
    });
  } catch (error) {
    next(error);
  }
};

// Change password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both current and new password are required.',
      });
    }

    const provider = await Provider.findById(req.user.id);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, provider.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    provider.password = await bcrypt.hash(newPassword, salt);
    await provider.save();

    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    next(error);
  }
};

export {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
};