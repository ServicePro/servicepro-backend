import mongoose from 'mongoose';

const ProviderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  category: {
    type: String,
  },
  bio: {
    type: String,
  },
  profile_image: {
    type: String,
  },
  rating: {
    type: Number,
    default: 4.5,
  },
  total_reviews: {
    type: Number,
    default: 0,
  },
  is_active: {
    type: Boolean,
    default: true,
  }
}, { timestamps: true });

export default mongoose.models.Provider || mongoose.model('Provider', ProviderSchema);
