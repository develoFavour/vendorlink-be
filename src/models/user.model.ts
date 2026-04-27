import mongoose, { Schema, Document, Types } from "mongoose";

export enum UserRole {
  BUYER = "BUYER",
  VENDOR = "VENDOR",
  ADMIN = "ADMIN",
}

export enum UserAccountStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  phone?: string;
  password?: string; // Optional if using OAuth later
  role: UserRole;
  accountStatus: UserAccountStatus;
  isVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      select: false, // Don't return password by default in queries
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.BUYER,
    },
    accountStatus: {
      type: String,
      enum: Object.values(UserAccountStatus),
      default: UserAccountStatus.ACTIVE,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

// We will hash passwords in the Service layer or using a pre-save hook.
// For clean architecture, service layer hashing is preferred, but hook is fine.

export const User = mongoose.models.User || mongoose.model<IUser>("User", userSchema);
