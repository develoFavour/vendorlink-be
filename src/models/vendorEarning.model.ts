import mongoose, { Document, Schema, Types } from "mongoose";
import { PaymentMethod } from "./order.model";

export enum VendorEarningStatus {
  PENDING = "Pending",
  AVAILABLE = "Available",
  CANCELLED = "Cancelled",
}

export interface IVendorEarning extends Document {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  orderId: Types.ObjectId;
  orderNumber: string;
  itemsSubtotal: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  paymentMethod: PaymentMethod;
  status: VendorEarningStatus;
  availableAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const vendorEarningSchema = new Schema<IVendorEarning>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    orderNumber: { type: String, required: true, trim: true, index: true },
    itemsSubtotal: { type: Number, required: true, min: 0 },
    commissionRate: { type: Number, required: true, min: 0, max: 100 },
    commissionAmount: { type: Number, required: true, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: Object.values(PaymentMethod), required: true },
    status: {
      type: String,
      enum: Object.values(VendorEarningStatus),
      default: VendorEarningStatus.PENDING,
      index: true,
    },
    availableAt: { type: Date },
  },
  { timestamps: true }
);

vendorEarningSchema.index({ orderId: 1, vendorId: 1 }, { unique: true });

export const VendorEarning =
  mongoose.models.VendorEarning ||
  mongoose.model<IVendorEarning>("VendorEarning", vendorEarningSchema);
