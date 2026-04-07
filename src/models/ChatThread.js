import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["user", "provider"],
      required: true,
    },
    senderName: { type: String, default: "" },
    content: { type: String, default: "" },
    fileUrl: { type: String, default: null },
    fileType: { type: String, enum: ["image", "file", null], default: null },
    fileName: { type: String, default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const chatThreadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      default: null,
    },
    serviceName: { type: String, default: "General Inquiry" },
    userName: { type: String, default: "" },
    providerName: { type: String, default: "" },
    messages: [messageSchema],
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    unreadCountUser: { type: Number, default: 0 },
    unreadCountProvider: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Index for fast lookup
chatThreadSchema.index({ userId: 1, lastMessageAt: -1 });
chatThreadSchema.index({ providerId: 1, lastMessageAt: -1 });

export default mongoose.models.ChatThread ||
  mongoose.model("ChatThread", chatThreadSchema);
