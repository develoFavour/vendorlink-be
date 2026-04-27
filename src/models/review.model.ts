import mongoose, { Document, Schema, Types } from "mongoose";

export enum ReviewModerationStatus {
  VISIBLE = "VISIBLE",
  HIDDEN = "HIDDEN",
}

export interface IReview extends Document {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  buyerId: Types.ObjectId;
  orderId: Types.ObjectId;
  rating: number;
  title?: string;
  comment?: string;
  isVerifiedPurchase: boolean;
  moderationStatus: ReviewModerationStatus;
  hiddenReason?: string;
  moderatedBy?: Types.ObjectId;
  moderatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    moderationStatus: {
      type: String,
      enum: Object.values(ReviewModerationStatus),
      default: ReviewModerationStatus.VISIBLE,
      index: true,
    },
    hiddenReason: {
      type: String,
      trim: true,
      maxlength: 240,
    },
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    moderatedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

reviewSchema.index({ productId: 1, buyerId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, rating: 1 });

export const Review =
  mongoose.models.Review || mongoose.model<IReview>("Review", reviewSchema);
