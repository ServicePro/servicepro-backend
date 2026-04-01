import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,

  email: { type: String, unique: true, sparse: true },

  password: String,

  isVerified: { type: Boolean, default: false },

  role: { type: String, enum: ["user", "admin", "provider"], default: "user" },

  googleId: { type: String, default: null },
  facebookId: { type: String, default: null },
  linkedinId: { type: String, default: null },

  resetOtp: { type: String, default: null },
  resetOtpExpiry: { type: Date, default: null }

}, { timestamps: true });

export default mongoose.model("User", userSchema);