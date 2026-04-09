import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    plan:      { type: String, enum: ["free", "standard", "premium"], default: "free" },
    startDate: { type: Date, default: Date.now },
    endDate:   { type: Date },
    loyaltyPoints: { type: Number, default: 0 },
    pendingReward: {
      rewardId:   { type: String, default: null },
      title:      { type: String, default: null },
      type:       { type: String, default: null }, // 'discount' | 'credit' | 'free_service' | 'priority'
      value:      { type: String, default: null }, // '10%' | '20%' | '$5' | '1 service'
    },
    pointsHistory: [
      {
        points:      Number,
        description: String,
        type:        { type: String, enum: ["earned", "redeemed"] },
        date:        { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Subscription", subscriptionSchema);
