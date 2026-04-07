import bcrypt from "bcryptjs";
import sendEmail from "../utils/sendEmail.js";

import Provider from "../models/Provider.js";
export { Provider };

// ── Register Provider ─────────────────────────────────────────────────────────
const VALID_CATEGORIES = ["Cleaning","Plumbing","Electrical","Carpentry","Painting","Beauty & Wellness","Home Repair","Other"];

function validateProviderInput({ name, email, phone, password, category, skills, experience, area, availability }) {
  const errors = {};

  // Name
  if (!name || !name.trim()) errors.name = "Full name is required.";
  else if (name.trim().length < 2) errors.name = "Name must be at least 2 characters.";

  // Email
  if (!email || !email.trim()) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = "Enter a valid email address.";

  // Phone — allow digits, spaces, hyphens, +, parentheses; 7–15 digits total
  if (!phone || !phone.trim()) errors.phone = "Phone number is required.";
  else if (!/^\+?[\d\s\-().]{7,20}$/.test(phone.trim())) errors.phone = "Enter a valid phone number.";

  // Password
  if (!password) errors.password = "Password is required.";
  else if (password.length < 6) errors.password = "Password must be at least 6 characters.";
  else if (!/[A-Za-z]/.test(password)) errors.password = "Password must contain at least one letter.";
  else if (!/[0-9]/.test(password)) errors.password = "Password must contain at least one number.";

  // Category
  if (!category || !category.trim()) errors.category = "Service category is required.";
  else if (!VALID_CATEGORIES.includes(category)) errors.category = "Select a valid service category.";

  // Skills
  if (!skills || !skills.trim()) errors.skills = "Skills description is required.";
  else if (skills.trim().length < 10) errors.skills = "Please describe your skills in at least 10 characters.";

  // Experience
  if (experience === undefined || experience === "") errors.experience = "Years of experience is required.";
  else if (isNaN(experience) || Number(experience) < 0) errors.experience = "Experience must be a non-negative number.";
  else if (Number(experience) > 60) errors.experience = "Experience value seems too large.";

  // Area
  if (!area || !area.trim()) errors.area = "Service area is required.";

  // Availability
  if (!availability || !availability.trim()) errors.availability = "Availability is required.";

  return errors;
}

export const registerProvider = async (req, res) => {
  try {
    const { name, email, phone, password, category, skills, experience, area, availability } = req.body;

    // Run all validations
    const errors = validateProviderInput({ name, email, phone, password, category, skills, experience, area, availability });
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ msg: "Validation failed", errors });
    }

    // Check duplicate email
    const existingProvider = await Provider.findOne({ email: email.trim().toLowerCase() });
    if (existingProvider) {
      return res.status(400).json({ msg: "A provider account with this email already exists.", errors: { email: "This email is already registered as a provider." } });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // File paths from multer
    const licenseFile = req.files?.license?.[0]?.path || null;
    const idProofFile = req.files?.idProof?.[0]?.path || null;
    const profileImage = req.files?.profilePhoto?.[0]?.path || null;

    await Provider.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password: hashedPassword,
      category,
      skills: skills.trim(),
      experience: String(experience),
      area: area.trim(),
      availability: availability.trim(),
      licenseFile,
      idProofFile,
      profile_image: profileImage,
    });

    // Confirmation email
    await sendEmail(
      email.trim().toLowerCase(),
      "ServicePro – Registration Received",
      `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 0;">
      <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:40px;">
        <tr><td>
          <h2 style="color:#333;margin-bottom:8px;">Thank you, ${name.trim()}!</h2>
          <p style="color:#555;font-size:15px;">Your service provider registration has been received and is currently <strong>pending admin review</strong>.</p>
          <p style="color:#555;font-size:15px;">You will receive another email once your account has been approved or rejected. This usually takes up to <strong>24 hours</strong>.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
          <p style="color:#aaa;font-size:12px;text-align:center;">ServicePro &mdash; Connecting you with trusted service providers</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
    );

    res.status(201).json({ msg: "Registration submitted for approval. Please check your email." });
  } catch (error) {
    console.error("Error registering provider:", error);
    res.status(500).json({ msg: "Server error. Please try again." });
  }
};

// ── Get Pending Providers (Admin) ─────────────────────────────────────────────
export const getPendingProviders = async (req, res) => {
  try {
    const pendingProviders = await Provider.find({ status: "pending" }).sort({ createdAt: -1 });
    res.json({ providers: pendingProviders });
  } catch (error) {
    console.error("Error fetching pending providers:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

// ── Approve / Reject Provider (Admin) ────────────────────────────────────────
export const approveProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "approve" or "reject"

    const status = action === "approve" ? "approved" : "rejected";

    const provider = await Provider.findByIdAndUpdate(id, { status }, { new: true });

    if (!provider) {
      return res.status(404).json({ msg: "Provider not found" });
    }

    const emailSubject = action === "approve"
      ? "Your ServicePro Registration Has Been Approved"
      : "Your ServicePro Registration Has Been Rejected";

    const emailHtml = action === "approve"
      ? `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px;">
          <div style="max-width:500px;margin:auto;background:#fff;border-radius:8px;padding:40px;">
            <h2 style="color:#10b981;">Congratulations, ${provider.name}!</h2>
            <p>Your service provider registration on <strong>ServicePro</strong> has been <strong>approved</strong>.</p>
            <p>You can now <a href="${process.env.FRONTEND_URL}/login">log in</a> and start offering your services.</p>
          </div></body></html>`
      : `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px;">
          <div style="max-width:500px;margin:auto;background:#fff;border-radius:8px;padding:40px;">
            <h2 style="color:#ef4444;">Hello, ${provider.name}</h2>
            <p>We regret to inform you that your service provider registration on <strong>ServicePro</strong> has been <strong>rejected</strong>.</p>
            <p>Please contact support for more information.</p>
          </div></body></html>`;

    await sendEmail(provider.email, emailSubject, emailHtml);

    res.json({ msg: `Provider ${action}d successfully` });
  } catch (error) {
    console.error("Error updating provider status:", error);
    res.status(500).json({ msg: "Server error" });
  }
};

// ── Get Provider Profile ─────────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const provider = await Provider.findById(req.user.id).select('-password');
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found.' });
    
    const providerData = provider.toObject();
    providerData.id = providerData._id;
    res.json({ success: true, data: { provider: providerData } });
  } catch (error) { next(error); }
};

export const updateProfile = async (req, res, next) => {
  try {
    const provider = await Provider.findById(req.user.id);
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found.' });
    
    const updates = ['name', 'phone', 'category'];
    updates.forEach(field => {
       if (req.body[field] !== undefined) provider[field] = req.body[field];
    });

    const profilePhoto = req.files?.profilePhoto?.[0];
    if (profilePhoto) {
      provider.profile_image = `/${profilePhoto.path.replace(/\\/g, '/')}`;
    }

    await provider.save();
    const providerData = provider.toObject();
    delete providerData.password;
    providerData.id = providerData._id;
    res.json({ success: true, message: 'Profile updated.', data: { provider: providerData } });
  } catch (error) { next(error); }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Required fields missing' });

    const provider = await Provider.findById(req.user.id);
    if (!provider) return res.status(404).json({ success: false, message: 'Provider not found.' });

    const isMatch = await bcrypt.compare(currentPassword, provider.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Incorrect current password' });

    const salt = await bcrypt.genSalt(10);
    provider.password = await bcrypt.hash(newPassword, salt);
    await provider.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) { next(error); }
};

// ── GET /api/providers/search?q=&category= ────────────────────────────────
// Public search used by the chat "New Conversation" modal
export const searchProviders = async (req, res) => {
  try {
    const { q = "", category = "" } = req.query;
    const filter = { status: "approved" };
    if (q.trim()) {
      filter.$or = [
        { name:     { $regex: q.trim(), $options: "i" } },
        { category: { $regex: q.trim(), $options: "i" } },
        { area:     { $regex: q.trim(), $options: "i" } },
      ];
    }
    if (category.trim()) filter.category = { $regex: category.trim(), $options: "i" };

    const providers = await Provider.find(filter)
      .select("_id name category area rating profile_image")
      .limit(20)
      .lean();

    res.json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/providers/featured?limit= ─────────────────────────────────────
export const getFeaturedProviders = async (req, res) => {
  try {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 12;

    const providers = await Provider.find({ status: { $ne: "rejected" } })
      .select("_id name category area rating total_reviews experience skills profile_image status")
      .sort({ createdAt: -1, rating: -1, total_reviews: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, data: providers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};