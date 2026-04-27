import { Types } from "mongoose";
import { Cart, ICart } from "../models/cart.model";

export class CartRepository {
  async findByUserId(userId: string): Promise<ICart | null> {
    return await Cart.findOne({ userId }).populate("items.productId");
  }

  async getOrCreate(userId: string): Promise<ICart> {
    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId: new Types.ObjectId(userId), items: [] } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    return cart;
  }

  async save(cart: ICart): Promise<ICart> {
    await cart.save();
    return await Cart.findById(cart._id).populate("items.productId") as ICart;
  }

  async clear(userId: string): Promise<ICart | null> {
    return await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: [] } },
      { returnDocument: "after" }
    ).populate("items.productId");
  }
}

export const cartRepository = new CartRepository();
