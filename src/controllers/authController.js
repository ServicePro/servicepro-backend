import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import sendEmail from "../utils/sendEmail.js";

import Provider from "../models/Provider.js";

// Lazy-load hack removed! We now import the correct single source of truth Provider model.
const getProvider = () => Provider;


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
    const normalizedEmail = email.trim().toLowerCase();

    // Check both collections using lowercase email
    const userRecord = await User.findOne({ email: normalizedEmail });
    const providerRecord = await Provider.findOne({ email: normalizedEmail });

    const existsAsUser = !!userRecord;
    const existsAsProvider = !!providerRecord;

    // Reject unregistered outright with 401 instead of a cryptic 400
    if (!existsAsUser && !existsAsProvider) {
       return res.status(401).json({ message: "Invalid email or password" });
    }

    // If email exists in both and no loginAs specified, ask the frontend
    if (existsAsUser && existsAsProvider && !loginAs) {
      return res.status(200).json({ ambiguous: true, message: "select_role" });
    }

    // ── Admin / User login (from User collection) ──────────────────────────
    if (loginAs === "user" || loginAs === "admin" || (!loginAs && existsAsUser && !existsAsProvider)) {
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
        user: {
          id: userRecord._id,
          name: userRecord.name,
          email: userRecord.email,
          role: userRecord.role,
          phone: userRecord.phone || "",
          avatar_url: userRecord.avatar_url || null,
        }
      });
    }

    // ── Provider login ────────────────────────────────────────────────────
    if (loginAs === "provider" || (!loginAs && !existsAsUser && existsAsProvider)) {
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

    return res.status(400).json({ message: "Invalid login configuration." });

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
    const { accessToken, loginAs } = req.body;
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

    const userRecord    = await User.findOne({ email });
    const providerRecord = await Provider.findOne({ email });

    // Email exists in both — ask the frontend which role to use
    if (userRecord && providerRecord && !loginAs) {
      return res.json({ ambiguous: true });
    }

    // ── Provider path ──────────────────────────────────────────────────────
    if (loginAs === "provider" || (!loginAs && !userRecord && providerRecord)) {
      if (!providerRecord) {
        return res.status(404).json({ message: "No provider account found for this Google account." });
      }
      if (!providerRecord.googleId) {
        providerRecord.googleId = googleId;
        await providerRecord.save();
      }
      const token = jwt.sign({ id: providerRecord._id, role: "provider" }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.json({
        token,
        user: { id: providerRecord._id, name: providerRecord.name, email: providerRecord.email, role: "provider" },
        message: "Google sign-in successful"
      });
    }

    // ── User path (default) ────────────────────────────────────────────────
    let user = userRecord;
    if (!user) {
      user = await User.create({
        name,
        email,
        password: googleId, // placeholder — not used for Google login
        isVerified: true,
        googleId
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      user.isVerified = true;
      await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || "",
        avatar_url: user.avatar_url || null,
      },
      message: "Google sign-in successful"
    });

  } catch (error) {
    console.error("Google auth error:", error.message);
    res.status(500).json({ message: "Google authentication failed" });
  }
};

// ─── Resolve social login when ambiguous (user chose role in frontend modal) ──
export const resolveSocialLogin = async (req, res) => {
  try {
    const { pendingToken, loginAs } = req.body;
    if (!pendingToken || !loginAs) {
      return res.status(400).json({ message: "pendingToken and loginAs are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }

    if (!decoded.pending) {
      return res.status(400).json({ message: "Invalid token" });
    }

    const { email, providerIdField, providerId } = decoded;

    if (loginAs === "provider") {
      const providerRecord = await Provider.findOne({ email });
      if (!providerRecord) return res.status(404).json({ message: "Provider account not found" });
      if (providerIdField && !providerRecord[providerIdField]) {
        providerRecord[providerIdField] = providerId;
        await providerRecord.save();
      }
      const token = jwt.sign({ id: providerRecord._id, role: "provider" }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.json({
        token,
        user: { id: providerRecord._id, name: providerRecord.name, email: providerRecord.email, role: "provider" }
      });
    } else {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User account not found" });
      if (providerIdField && !user[providerIdField]) {
        user[providerIdField] = providerId;
        await user.save();
      }
      const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.json({
        token,
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
      });
    }
  } catch (err) {
    console.error("Resolve social login error:", err.message);
    res.status(500).json({ message: "Failed to complete sign-in" });
  }
};

// ─── Shared helper for server-side social OAuth (LinkedIn, Facebook) ──────────
const FRONTEND = () => process.env.FRONTEND_URL || "http://localhost:5173";

const handleSocialUser = async (res, { email, name, providerIdField, providerId, loginAs }) => {
  try {
    const userRecord     = await User.findOne({ email });
    const providerRecord = await Provider.findOne({ email });

    // Email registered in both — send back a short-lived pending token so
    // the frontend can ask the user which role they want
    if (userRecord && providerRecord && !loginAs) {
      const pendingToken = jwt.sign(
        { email, name, providerIdField, providerId, pending: true },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      );
      return res.redirect(
        `${FRONTEND()}/auth/callback?ambiguous=1&pendingToken=${pendingToken}&name=${encodeURIComponent(name || email)}`
      );
    }

    // ── Provider path ──────────────────────────────────────────────────────
    if (loginAs === "provider" || (!loginAs && !userRecord && providerRecord)) {
      if (!providerRecord) {
        return res.redirect(`${FRONTEND()}/auth/callback?error=server_error`);
      }
      if (!providerRecord[providerIdField]) {
        providerRecord[providerIdField] = providerId;
        await providerRecord.save();
      }
      const token = jwt.sign({ id: providerRecord._id, role: "provider" }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.redirect(
        `${FRONTEND()}/auth/callback?token=${token}&name=${encodeURIComponent(providerRecord.name)}&role=provider`
      );
    }

    // ── User path (default) ────────────────────────────────────────────────
    let user = userRecord;
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
    const normalizedEmail = email.trim().toLowerCase();

    // Find in both User and Provider collections
    const user = await User.findOne({ email: normalizedEmail });
    const provider = await Provider.findOne({ email: normalizedEmail });

    if (!user && !provider) {
      // Don't reveal whether email exists — always say sent
      return res.json({ message: "If that email is registered, an OTP has been sent." });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update whichever records exist
    if (user) {
      user.resetOtp = otp;
      user.resetOtpExpiry = expiry;
      await user.save();
    }
    if (provider) {
      provider.resetOtp = otp;
      provider.resetOtpExpiry = expiry;
      await provider.save();
    }

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
    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    const provider = await Provider.findOne({ email: normalizedEmail });
    const activeRecords = [user, provider].filter(Boolean);

    if (activeRecords.length === 0) {
      return res.status(400).json({ message: "Invalid OTP or email" });
    }

    // Check OTP on the first valid record (they both have the same OTP)
    const primaryRecord = activeRecords[0];
    if (!primaryRecord.resetOtp || primaryRecord.resetOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (!primaryRecord.resetOtpExpiry || primaryRecord.resetOtpExpiry < new Date()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new one." });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Apply new password to BOTH collections if the user has dual accounts
    if (user) {
        user.password = hashed;
        user.resetOtp = null;
        user.resetOtpExpiry = null;
        await user.save();
    }
    if (provider) {
        provider.password = hashed;
        provider.resetOtp = null;
        provider.resetOtpExpiry = null;
        await provider.save();
    }

    res.json({ message: "Password reset successful." });
  } catch (err) {
    console.error("Reset password error:", err.message);
    res.status(500).json({ message: "Failed to reset password. Please try again." });
  }
};
