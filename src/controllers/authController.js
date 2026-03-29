import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

// ── Helper: generate JWT ──────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
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

    const [existing] = await pool.execute(
      'SELECT id FROM providers WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await pool.execute(
      `INSERT INTO providers (name, email, password, phone, category, bio)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, phone || null, category || null, bio || null]
    );

    const providerId = result.insertId;

    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, category, profile_image, rating, created_at FROM providers WHERE id = ?',
      [providerId]
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful.',
      data: {
        provider: rows[0],
        token: generateToken(providerId),
      },
    });
  } catch (error) {
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

    const [rows] = await pool.execute(
      'SELECT * FROM providers WHERE email = ? AND is_active = 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const provider = rows[0];

    const isMatch = await bcrypt.compare(password, provider.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    const { password: _, ...providerData } = provider;

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        provider: providerData,
        token: generateToken(provider.id),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get profile
const getMe = async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, email, phone, category, bio, profile_image, rating, total_reviews, created_at
       FROM providers WHERE id = ?`,
      [req.provider.id]
    );

    res.json({ success: true, data: { provider: rows[0] } });
  } catch (error) {
    next(error);
  }
};

// Update profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, category, bio } = req.body;
    const providerId = req.provider.id;

    await pool.execute(
      `UPDATE providers SET name = ?, phone = ?, category = ?, bio = ?, updated_at = NOW()
       WHERE id = ?`,
      [name || req.provider.name, phone || null, category || null, bio || null, providerId]
    );

    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, category, bio, profile_image, rating, total_reviews FROM providers WHERE id = ?',
      [providerId]
    );

    res.json({
      success: true,
      message: 'Profile updated.',
      data: { provider: rows[0] },
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

    const [rows] = await pool.execute(
      'SELECT password FROM providers WHERE id = ?',
      [req.provider.id]
    );

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHashed = await bcrypt.hash(newPassword, salt);

    await pool.execute(
      'UPDATE providers SET password = ?, updated_at = NOW() WHERE id = ?',
      [newHashed, req.provider.id]
    );

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