import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,

  email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },

  password: String,

  phone: { type: String, default: "" },

  avatar_url: { type: String, default: null },

  isVerified: { type: Boolean, default: false },

  role: { type: String, enum: ["user", "admin", "provider"], default: "user" },

  // Optional profile fields
  phone:    { type: String, default: "" },
  bio:      { type: String, default: "" },
  address:  { type: String, default: "" },
  dob:      { type: String, default: "" },
  avatarUrl:{ type: String, default: "" },

  googleId: { type: String, default: null },
  facebookId: { type: String, default: null },
  linkedinId: { type: String, default: null },

  resetOtp: { type: String, default: null },
  resetOtpExpiry: { type: Date, default: null }

}, { timestamps: true });

userSchema.pre("save", async function savePassword() {
  if (!this.isModified("password") || !this.password) {
    return;
  }

  // Avoid double-hashing passwords that were already hashed upstream.
  if (this.password.startsWith("$2")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = async function matchPassword(enteredPassword) {
  if (!this.password) return false;
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);