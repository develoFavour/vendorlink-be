import mongoose, { Schema, Document, Types } from "mongoose";

export interface IWishlistItem extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const wishlistItemSchema = new Schema<IWishlistItem>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

wishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const WishlistItem =
  mongoose.models.WishlistItem ||
  mongoose.model<IWishlistItem>("WishlistItem", wishlistItemSchema);
