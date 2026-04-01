import mongoose from 'mongoose';

const ServiceSchema = new mongoose.Schema({
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  price: {
    type: Number,
    required: true,
  },
  duration_minutes: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  total_bookings: {
    type: Number,
    default: 0,
  },
  image_url: {
    type: String,
    default: null,
  },
  available_days: {
    type: [String],
    default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  },
  max_bookings_per_day: {
    type: Number,
    default: 5,
  }
}, { timestamps: true });

export default mongoose.models.Service || mongoose.model('Service', ServiceSchema);
