import mongoose from "mongoose";

const emergencyRequestSchema = new mongoose.Schema(
  {
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    serviceType: { type: String, required: true },
    description: { type: String, required: true },
    location:    { type: String, required: true },
    urgency:     { type: String, enum: ["high", "critical"], default: "high" },
    basePrice:   { type: Number, required: true },
    finalPrice:  { type: Number, required: true },
    status:      { type: String, enum: ["pending", "assigned", "en_route", "completed", "cancelled"], default: "pending" },
    providerId:  { type: mongoose.Schema.Types.ObjectId, ref: "Provider", default: null },
    eta:         { type: String },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "failed", "cash_pending"], default: "unpaid" },
    paymentId:   { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("EmergencyRequest", emergencyRequestSchema);
