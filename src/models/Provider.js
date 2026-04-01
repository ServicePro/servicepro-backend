import mongoose from 'mongoose';

const ProviderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String },
  category: { type: String },
  bio: { type: String },
  profile_image: { type: String },
  rating: { type: Number, default: 4.5 },
  total_reviews: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
  
  // Teammate's newly added fields
  skills: { type: String },
  experience: { type: String },
  area: { type: String },
  availability: { type: String },
  licenseFile: { type: String, default: null },
  idProofFile: { type: String, default: null },
  
  // Auto-approved for Dev testing
  status: { type: String, default: 'approved' },
  
  // OTP logic
  resetOtp: { type: String, default: null },
  resetOtpExpiry: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.models.Provider || mongoose.model('Provider', ProviderSchema);
