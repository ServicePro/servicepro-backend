import jwt from 'jsonwebtoken';
import Provider from '../models/Provider.js';

// ── Protect routes: validate JWT ─────────────────────────────
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

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'servicepro_super_secret_jwt_key_change_in_production');

    // Attach provider from DB to request
    const provider = await Provider.findOne({ _id: decoded.id, is_active: true });

    if (!provider) {
      return res.status(401).json({
        success: false,
        message: 'Provider account not found or deactivated.',
      });
    }

    // Attach user obj structure so standard controllers (req.user.id) can use it seamlessly
    req.user = { id: provider._id.toString() }; 
    req.provider = provider; // keep backwards compatibility

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

export { protect };