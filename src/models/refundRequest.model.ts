import mongoose, { Schema, Document, Types } from "mongoose";
import { PaymentMethod } from "./order.model";

export enum RefundRequestStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected",
  REFUNDED = "Refunded",
}

export interface IRefundRequest extends Document {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  buyerId: Types.ObjectId;
  reason: string;
  status: RefundRequestStatus;
  requestedAmount: number;
  deductionPercent: number;
  deductionAmount: number;
  finalRefundAmount: number;
  paymentMethod: PaymentMethod;
  createdAt: Date;
  updatedAt: Date;
}

const refundRequestSchema = new Schema<IRefundRequest>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(RefundRequestStatus),
      default: RefundRequestStatus.PENDING,
      index: true,
    },
    requestedAmount: { type: Number, required: true, min: 0 },
    deductionPercent: { type: Number, required: true, min: 0, max: 100 },
    deductionAmount: { type: Number, required: true, min: 0 },
    finalRefundAmount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
  },
  { timestamps: true }
);

refundRequestSchema.index(
  { orderId: 1, buyerId: 1, status: 1 },
  { partialFilterExpression: { status: RefundRequestStatus.PENDING } }
);

export const RefundRequest =
  mongoose.models.RefundRequest ||
  mongoose.model<IRefundRequest>("RefundRequest", refundRequestSchema);
