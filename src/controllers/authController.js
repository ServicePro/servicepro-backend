import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sendEmail from "../utils/sendEmail.js";
import mongoose from "mongoose";

// Lazy-load Provider model from providerController's schema
let _Provider = null;
const getProvider = () => {
  if (!_Provider) {
    _Provider = mongoose.models.Provider || mongoose.model("Provider", new mongoose.Schema({
      name: String, email: String, password: String, status: String,
      resetOtp: String, resetOtpExpiry: Date,
      category: String, skills: String, experience: String, area: String, availability: String
    }));
  }
  return _Provider;
};


export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // check existing
    const userExists = await User.findOne({ email });
    if (userExists) {
      if (!userExists.isVerified) {
        // delete unverified user so they can re-register
        await User.deleteOne({ email });
      } else {
        return res.status(400).json({ message: "User already exists" });
      }
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    // create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d"
    });

    // verification link
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const url = `${baseUrl}/verify/${token}`;

    await sendEmail(
      email,
      "Verify your ServicePro account",
      `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 0;">
      <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;">
        <tr><td>
          <h2 style="color:#333;margin-bottom:8px;">Welcome to ServicePro, ${name}!</h2>
          <p style="color:#555;font-size:15px;">Thank you for registering. Please verify your email address to activate your account.</p>
          <p style="text-align:center;margin:32px 0;">
            <a href="${url}" style="background:#4f46e5;color:#ffffff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:bold;">Verify My Account</a>
          </p>
          <p style="color:#888;font-size:13px;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="color:#aaa;font-size:12px;text-align:center;">ServicePro &mdash; Connecting you with trusted service providers</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    );

    res.json({ message: "Verification email sent" });

  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// login user
export const loginUser = async (req, res) => {
  try {
    const { email, password, loginAs } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const Provider = getProvider();

    // Check both collections
    const userRecord = await User.findOne({ email });
    const providerRecord = await Provider.findOne({ email });

    const existsAsUser = !!userRecord;
    const existsAsProvider = !!providerRecord;

    // If email exists in both and no loginAs specified, ask the frontend
    if (existsAsUser && existsAsProvider && !loginAs) {
      return res.status(200).json({ ambiguous: true, message: "select_role" });
    }

    // ── Admin / User login (from User collection) ──────────────────────────
    if (loginAs === "user" || loginAs === "admin" || (!loginAs && existsAsUser)) {
      if (!userRecord) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!userRecord.isVerified) {
        return res.status(403).json({ message: "Please verify your email before logging in" });
      }

      if (!userRecord.password) {
        return res.status(401).json({ message: "This account uses Google sign-in. Please log in with Google." });
      }

      const isMatch = await bcrypt.compare(password, userRecord.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign({ id: userRecord._id, role: userRecord.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.json({
        token,
        user: { id: userRecord._id, name: userRecord.name, email: userRecord.email, role: userRecord.role }
      });
    }

    // ── Provider login ────────────────────────────────────────────────────
    if (loginAs === "provider" || (!loginAs && !existsAsUser && existsAsProvider)) {
      if (!providerRecord) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (providerRecord.status !== "approved") {
        return res.status(403).json({ message: "Your provider account is pending approval or has been rejected." });
      }

      const isMatch = await bcrypt.compare(password, providerRecord.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const token = jwt.sign({ id: providerRecord._id, role: "provider" }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.json({
        token,
        user: { id: providerRecord._id, name: providerRecord.name, email: providerRecord.email, role: "provider" }
      });
    }

    return res.status(400).json({ message: "Invalid loginAs value" });

  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

// verify user
export const verifyUser = async (req, res) => {
  try {
    const { token } = req.params;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    await User.findByIdAndUpdate(decoded.id, { isVerified: true });

    res.json({ success: true, message: "Account verified successfully" });

  } catch (err) {
    res.status(400).json({ success: false, message: "Invalid or expired token" });
  }
};

// Google OAuth sign-up / sign-in
export const googleAuth = async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ message: "Access token required" });
    }

    // Fetch the user's profile from Google
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) {
      return res.status(401).json({ message: "Invalid Google token" });
    }
    const profile = await response.json();
    const { email, name, sub: googleId } = profile;

    if (!email) {
      return res.status(400).json({ message: "Could not retrieve email from Google" });
    }

    // Find or create the user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        password: googleId, // placeholder — not used for Google login
        isVerified: true,
        googleId
      });
    } else if (user.isVerified && !user.googleId) {
      // Email already registered via normal signup — block duplicate
      return res.status(400).json({
        message: "This email is already registered. Please sign in with your password instead."
      });
    } else if (!user.googleId) {
      // Unverified normal account — link Google and verify
      user.googleId = googleId;
      user.isVerified = true;
      await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      message: "Google sign-in successful"
    });

  } catch (error) {
    console.error("Google auth error:", error.message);
    res.status(500).json({ message: "Google authentication failed" });
  }
};

// ─── Shared helper for server-side social OAuth (LinkedIn, Facebook) ──────────
const FRONTEND = () => process.env.FRONTEND_URL || "http://localhost:5173";

const handleSocialUser = async (res, { email, name, providerIdField, providerId }) => {
  try {
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: name || email.split("@")[0],
        email,
        isVerified: true,
        [providerIdField]: providerId
      });
    } else if (user[providerIdField]) {
      // Already linked — just sign in
    } else if (!user.googleId && !user.linkedinId && !user.facebookId) {
      // Email+password account — block
      return res.redirect(`${FRONTEND()}/auth/callback?error=email_exists`);
    } else {
      // Has other social logins — link this one too
      user[providerIdField] = providerId;
      await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.redirect(
      `${FRONTEND()}/auth/callback?token=${token}&name=${encodeURIComponent(user.name)}&role=${user.role}`
    );
  } catch (err) {
    console.error(`Social login error (${providerIdField}):`, err.message);
    return res.redirect(`${FRONTEND()}/auth/callback?error=server_error`);
  }
};

// ─── LinkedIn ─────────────────────────────────────────────────────────────────
export const linkedinInitiate = (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/linkedin/callback`,
    scope: "openid profile email",
    state: Math.random().toString(36).slice(2)
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
};

export const linkedinCallback = async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`${FRONTEND()}/auth/callback?error=cancelled`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET
      })
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.redirect(`${FRONTEND()}/auth/callback?error=token_failed`);
    }

    // Get user profile
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileRes.json();
    const { sub: linkedinId, name, email } = profile;

    if (!email) {
      return res.redirect(`${FRONTEND()}/auth/callback?error=no_email`);
    }

    await handleSocialUser(res, { email, name, providerIdField: "linkedinId", providerId: linkedinId });
  } catch (err) {
    console.error("LinkedIn callback error:", err.message);
    res.redirect(`${FRONTEND()}/auth/callback?error=server_error`);
  }
};

// ─── Facebook ─────────────────────────────────────────────────────────────────
export const facebookInitiate = (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    redirect_uri: `${process.env.BACKEND_URL || "http://localhost:5000"}/api/auth/facebook/callback`,
    scope: "email,public_profile",
    response_type: "code",
    state: Math.random().toString(36).slice(2)
  });
  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`);
};

export const facebookCallback = async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`${FRONTEND()}/auth/callback?error=cancelled`);
  }

  try {
    const BACKEND = process.env.BACKEND_URL || "http://localhost:5000";
    // Exchange code for access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: `${BACKEND}/api/auth/facebook/callback`,
        code
      })
    );
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.redirect(`${FRONTEND()}/auth/callback?error=token_failed`);
    }

    // Get user profile
    const profileRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`
    );
    const profile = await profileRes.json();
    const { id: facebookId, name, email } = profile;

    if (!email) {
      return res.redirect(`${FRONTEND()}/auth/callback?error=no_email`);
    }

    await handleSocialUser(res, { email, name, providerIdField: "facebookId", providerId: facebookId });
  } catch (err) {
    console.error("Facebook callback error:", err.message);
    res.redirect(`${FRONTEND()}/auth/callback?error=server_error`);
  }
};

// ─── Forgot Password — send OTP ───────────────────────────────────────────────
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const Provider = getProvider();

    // Find in User or Provider collection
    const user = await User.findOne({ email });
    const provider = await Provider.findOne({ email });
    const record = user || provider;

    if (!record) {
      // Don't reveal whether email exists — always say sent
      return res.json({ message: "If that email is registered, an OTP has been sent." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    record.resetOtp = otp;
    record.resetOtpExpiry = expiry;
    await record.save();

    await sendEmail(
      email,
      "Your ServicePro Password Reset OTP",
      `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 0;">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;">
        <tr><td>
          <h2 style="color:#333;margin-bottom:8px;">Password Reset Request</h2>
          <p style="color:#555;font-size:15px;">Use the OTP below to reset your ServicePro password. It expires in <strong>10 minutes</strong>.</p>
          <div style="text-align:center;margin:32px 0;">
            <span style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 32px;border-radius:8px;">${otp}</span>
          </div>
          <p style="color:#888;font-size:13px;">If you did not request a password reset, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="color:#aaa;font-size:12px;text-align:center;">ServicePro &mdash; Connecting you with trusted service providers</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    );

    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

// ─── Reset Password — verify OTP & set new password ──────────────────────────
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) {
      return res.status(400).json({ message: "Email, OTP, and new password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ message: "Password must contain at least one uppercase letter" });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ message: "Password must contain at least one lowercase letter" });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ message: "Password must contain at least one number" });
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({ message: "Password must contain at least one special character" });
    }

    const Provider = getProvider();

    const user = await User.findOne({ email });
    const provider = await Provider.findOne({ email });
    const record = user || provider;

    if (!record) {
      return res.status(400).json({ message: "Invalid OTP or email" });
    }

    if (!record.resetOtp || record.resetOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (!record.resetOtpExpiry || record.resetOtpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    const hashed = await bcrypt.hash(password, 10);
    record.password = hashed;
    record.resetOtp = null;
    record.resetOtpExpiry = null;
    await record.save();

    res.json({ message: "Password reset successful." });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ message: "Failed to reset password. Please try again." });
  }
};
