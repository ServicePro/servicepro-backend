import mongoose from 'mongoose';

const appReviewSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    rating:   { type: Number, required: true, min: 1, max: 5 },
    comment:  { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

export default mongoose.model('AppReview', appReviewSchema);
