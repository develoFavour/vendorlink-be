import mongoose, { Schema, Document, Types } from "mongoose";

export enum OrderStatus {
  PENDING = "Pending",
  PROCESSING = "Processing",
  READY = "Ready",
  IN_TRANSIT = "In Transit",
  DELIVERED = "Delivered",
  CANCELLED = "Cancelled",
}

export enum PaymentMethod {
  CASH_ON_DELIVERY = "Cash on Delivery",
  BANK_TRANSFER = "Bank Transfer",
  MOBILE_MONEY = "Mobile Money",
  PAYSTACK = "Paystack",
}

export enum PaymentStatus {
  PENDING = "Pending",
  PAID = "Paid",
  FAILED = "Failed",
}

export interface IOrderItem {
  productId: Types.ObjectId;
  vendorId: Types.ObjectId;
  name: string;
  image: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface IOrderStatusHistory {
  status: OrderStatus;
  note?: string;
  updatedBy: Types.ObjectId;
  updatedAt: Date;
}

export interface IOrderFulfillment {
  vendorId: Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  status: OrderStatus;
  trackingNote?: string;
  statusHistory: IOrderStatusHistory[];
  updatedAt?: Date;
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  buyerId: Types.ObjectId;
  items: IOrderItem[];
  fulfillments: IOrderFulfillment[];
  deliveryAddress: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    note?: string;
  };
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  paymentAccessCode?: string;
  paidAt?: Date;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    image: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new Schema<IOrderStatusHistory>(
  {
    status: { type: String, enum: Object.values(OrderStatus), required: true },
    note: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderFulfillmentSchema = new Schema<IOrderFulfillment>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true,
    },
    trackingNote: { type: String, trim: true },
    statusHistory: { type: [statusHistorySchema], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [orderItemSchema], required: true },
    fulfillments: { type: [orderFulfillmentSchema], default: [] },
    deliveryAddress: {
      fullName: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      note: { type: String, trim: true },
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    paymentReference: { type: String, trim: true, index: true },
    paymentAccessCode: { type: String, trim: true },
    paidAt: { type: Date },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
  },
  { timestamps: true }
);

export const Order = mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);
