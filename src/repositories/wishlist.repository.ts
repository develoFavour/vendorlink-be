import { Types } from "mongoose";
import { IWishlistItem, WishlistItem } from "../models/wishlist.model";

export class WishlistRepository {
  async findByUserId(userId: string): Promise<IWishlistItem[]> {
    return await WishlistItem.find({ userId }).populate("productId").sort({ createdAt: -1 });
  }

  async findOne(userId: string, productId: string): Promise<IWishlistItem | null> {
    return await WishlistItem.findOne({ userId, productId });
  }

  async add(userId: string, productId: string): Promise<IWishlistItem> {
    return await WishlistItem.findOneAndUpdate(
      { userId, productId },
      {
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          productId: new Types.ObjectId(productId),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }

  async remove(userId: string, productId: string): Promise<IWishlistItem | null> {
    return await WishlistItem.findOneAndDelete({ userId, productId });
  }
}

export const wishlistRepository = new WishlistRepository();
