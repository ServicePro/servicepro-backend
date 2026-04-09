import mongoose from "mongoose";

const consultationSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User",     required: true },
    providerId:   { type: mongoose.Schema.Types.ObjectId, ref: "Provider", required: true },
    serviceId:    { type: mongoose.Schema.Types.ObjectId, ref: "Service",  required: false },
    topic:        { type: String, required: true },
    scheduledAt:  { type: Date, required: true },
    duration:     { type: Number, default: 30 }, // minutes
    roomId:         { type: String },
    meetLink:       { type: String },
    status:         { type: String, enum: ["scheduled", "in_progress", "completed", "cancelled"], default: "scheduled" },
    providerStatus: { type: String, enum: ["pending", "accepted", "rescheduled", "declined"], default: "pending" },
    proposedAt:     { type: Date },   // provider's suggested alternate time
    notes:          { type: String },
    recordingUrl:   { type: String },
  },
  { timestamps: true }
);

// Generate a unique room ID before saving (Mongoose 9: async style, no next)
consultationSchema.pre("save", function () {
  if (!this.roomId) {
    this.roomId = `sp-room-${this._id}`;
  }
});

export default mongoose.models.Consultation || mongoose.model("Consultation", consultationSchema);
