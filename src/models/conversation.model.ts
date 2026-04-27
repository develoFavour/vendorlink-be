import mongoose, { Schema, Document, Types } from "mongoose";

export interface IConversation extends Document {
  _id: Types.ObjectId;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  productId?: Types.ObjectId;
  orderId?: Types.ObjectId;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadByBuyer: number;
  unreadBySeller: number;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    lastMessage: { type: String, trim: true },
    lastMessageAt: { type: Date, index: true },
    unreadByBuyer: { type: Number, default: 0, min: 0 },
    unreadBySeller: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

conversationSchema.index(
  { buyerId: 1, sellerId: 1, productId: 1 },
  { unique: true, partialFilterExpression: { productId: { $exists: true } } }
);
conversationSchema.index({ buyerId: 1, lastMessageAt: -1 });
conversationSchema.index({ sellerId: 1, lastMessageAt: -1 });

export const Conversation =
  mongoose.models.Conversation ||
  mongoose.model<IConversation>("Conversation", conversationSchema);
