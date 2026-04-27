import mongoose, { Schema, Document, Types } from "mongoose";

export enum StoreCategory {
  FASHION = "fashion",
  ELECTRONICS = "electronics",
  GROCERIES = "groceries",
  OTHER = "other",
}

export enum StoreStatus {
  PENDING = "PENDING",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

export interface IStore extends Document {
  vendorId: Types.ObjectId;
  storeName: string;
  slug: string;
  description?: string;
  category: StoreCategory;
  address?: string;
  kyc?: {
    bankName?: string;
    accountNumber?: string;
    cacNumber?: string;
  };
  status: StoreStatus;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<IStore>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One user = One store
    },
    storeName: {
      type: String,
      required: [true, "Store name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: Object.values(StoreCategory),
      required: true,
    },
    address: {
      type: String,
      trim: true,
    },
    kyc: {
      bankName: String,
      accountNumber: String,
      cacNumber: String,
    },
    status: {
      type: String,
      enum: Object.values(StoreStatus),
      default: StoreStatus.PENDING,
    },
  },
  {
    timestamps: true,
  }
);

export const Store = mongoose.models.Store || mongoose.model<IStore>("Store", storeSchema);
