import mongoose, { Document, Schema, Types } from "mongoose";

export enum WithdrawalStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  PROCESSING = "Processing",
  PAID = "Paid",
  REJECTED = "Rejected",
  FAILED = "Failed",
}

export interface IWithdrawalRequest extends Document {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  amount: number;
  bankName: string;
  bankCode?: string;
  accountNumber: string;
  accountName: string;
  status: WithdrawalStatus;
  vendorNote?: string;
  adminNote?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  paidAt?: Date;
  paystackRecipientCode?: string;
  paystackTransferCode?: string;
  paystackTransferReference?: string;
  paystackTransferStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    vendorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    bankName: { type: String, required: true, trim: true },
    bankCode: { type: String, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(WithdrawalStatus),
      default: WithdrawalStatus.PENDING,
      index: true,
    },
    vendorNote: { type: String, trim: true },
    adminNote: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    paidAt: { type: Date },
    paystackRecipientCode: { type: String, trim: true },
    paystackTransferCode: { type: String, trim: true },
    paystackTransferReference: { type: String, trim: true, index: true },
    paystackTransferStatus: { type: String, trim: true },
  },
  { timestamps: true }
);

export const WithdrawalRequest =
  mongoose.models.WithdrawalRequest ||
  mongoose.model<IWithdrawalRequest>("WithdrawalRequest", withdrawalRequestSchema);
