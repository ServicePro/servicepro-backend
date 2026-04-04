import jwt from 'jsonwebtoken';
import Provider from '../models/Provider.js';
import User from '../models/User.js';

// ── Protect routes ─────────────────────────────
const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorised. No token.',
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'servicepro_super_secret_jwt_key_change_in_production'
    );

    let account = null;
    let role = null;

    // ✅ Provider (ONLY approved)
    account = await Provider.findOne({
      _id: decoded.id,
      is_active: true,
      status: "approved"
    });

    if (account) {
      role = "provider";
    } else {
      // ✅ User
      account = await User.findOne({
        _id: decoded.id,
        isVerified: true
      });

      if (account) {
        role = account.role || "user";
      }
    }

    if (!account) {
      return res.status(401).json({
        success: false,
        message: 'Account not found, not approved, or deactivated.',
      });
    }

    req.user = {
      id: account._id.toString(),
      role
    };

    req.provider = account;

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
};

// ── Admin only ─────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only.",
    });
  }
  next();
};

// ✅ EXPORTS (THIS FIXES YOUR ERROR)
export { protect, adminOnly };