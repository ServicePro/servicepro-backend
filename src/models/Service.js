import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
      index: true,
    },

    // 🔹 Basic Info
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // 🔹 Pricing
    price: {
      type: Number,
      required: true,
    },
    pricing_type: {
      type: String,
      enum: ["hourly", "fixed"],
      default: "fixed",
    },

    duration_minutes: {
      type: Number,
      required: true,
    },

    // 🔹 Status
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // 🔹 Booking Analytics
    total_bookings: {
      type: Number,
      default: 0,
    },

    // 🔹 Ratings (VERY IMPORTANT for UI)
    rating: {
      type: Number,
      default: 4.5,
      min: 0,
      max: 5,
    },
    reviews_count: {
      type: Number,
      default: 0,
    },

    // 🔹 UI Features
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },

    // 🔹 Media
    image_url: {
      type: String,
      default: null,
    },

    // 🔹 Availability
    available_days: {
      type: [String],
      default: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    },
    max_bookings_per_day: {
      type: Number,
      default: 5,
    },

    // 🔹 Location (for future map + filtering)
    location: {
      city: String,
      district: String,
    },

    // 🔹 Search Optimization (🔥 PRO FEATURE)
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

// 🔍 FULL TEXT SEARCH (VERY IMPORTANT)
ServiceSchema.index({
  name: "text",
  category: "text",
  description: "text",
  tags: "text",
});

export default mongoose.models.Service ||
  mongoose.model("Service", ServiceSchema);