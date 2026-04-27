import { Types } from "mongoose";
import { IOrder, IOrderFulfillment, Order, OrderStatus, PaymentStatus } from "../models/order.model";
import { User, UserRole } from "../models/user.model";
import { VendorEarning, VendorEarningStatus } from "../models/vendorEarning.model";
import { WithdrawalRequest, WithdrawalStatus } from "../models/withdrawalRequest.model";
import { ApiError } from "../utils/ApiError";
import { sendWithdrawalStatusEmail } from "../utils/email";
import { paystack } from "../utils/paystack";

type CurrentUser = {
  id: string;
  role: UserRole;
};

type EarningQuery = {
  status?: VendorEarningStatus | WithdrawalStatus | "All";
  search?: string;
  page?: string | number;
  limit?: string | number;
  sort?: string;
};

type WithdrawalPayload = {
  amount?: number;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  vendorNote?: string;
};

type AdminWithdrawalPayload = {
  note?: string;
};

const PLATFORM_COMMISSION_RATE = Number(process.env.PLATFORM_COMMISSION_RATE || 10);
const MIN_WITHDRAWAL_AMOUNT = Number(process.env.MIN_WITHDRAWAL_AMOUNT || 1000);

const trimValue = (value?: string) => (typeof value === "string" ? value.trim() : "");

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPositiveInteger = (value: unknown, fallback: number, max = 100) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const generateTransferReference = () =>
  `VL-TRF-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

class EarningService {
  private ensureSeller(user: CurrentUser) {
    if (user.role !== UserRole.VENDOR && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only sellers can access earnings");
    }
  }

  private ensureAdmin(user: CurrentUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only admins can manage withdrawals");
    }
  }

  private ensureObjectId(id: string, label: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(400, `Invalid ${label}`);
    }
  }

  private getPayoutMode() {
    return (process.env.PAYOUT_MODE || "manual").toLowerCase();
  }

  private getEarningStatus(order: IOrder, fulfillment: IOrderFulfillment) {
    if (fulfillment.status === OrderStatus.CANCELLED || order.status === OrderStatus.CANCELLED) {
      return VendorEarningStatus.CANCELLED;
    }

    if (order.paymentStatus === PaymentStatus.FAILED) {
      return VendorEarningStatus.CANCELLED;
    }

    if (fulfillment.status === OrderStatus.DELIVERED && order.paymentStatus === PaymentStatus.PAID) {
      return VendorEarningStatus.AVAILABLE;
    }

    return VendorEarningStatus.PENDING;
  }

  private getOrderFulfillments(order: IOrder) {
    if (order.fulfillments?.length) return order.fulfillments;

    const grouped = new Map<string, IOrderFulfillment>();

    order.items.forEach((item) => {
      const vendorId = item.vendorId.toString();
      const current = grouped.get(vendorId);

      if (current) {
        current.items.push(item);
        current.subtotal += item.lineTotal;
        return;
      }

      grouped.set(vendorId, {
        vendorId: item.vendorId,
        items: [item],
        subtotal: item.lineTotal,
        status: order.status,
        statusHistory: [],
        updatedAt: order.updatedAt,
      });
    });

    return Array.from(grouped.values());
  }

  private serializeEarning(earning: any) {
    const plain = earning.toObject ? earning.toObject() : earning;
    return plain;
  }

  private serializeWithdrawal(withdrawal: any) {
    const plain = withdrawal.toObject ? withdrawal.toObject() : withdrawal;
    const vendor = plain.vendorId;

    return {
      ...plain,
      vendorName: vendor?.fullName,
      vendorEmail: vendor?.email,
      vendorId: vendor?._id || plain.vendorId,
    };
  }

  private sendWithdrawalStatusEmailSafely(
    withdrawal: any,
    status: "Approved" | "Rejected" | "Paid"
  ) {
    User.findById(withdrawal.vendorId)
      .then((vendor) => {
        if (!vendor) return;

        return sendWithdrawalStatusEmail({
          email: vendor.email,
          fullName: vendor.fullName,
          amount: withdrawal.amount,
          status,
          bankName: withdrawal.bankName,
          accountNumber: withdrawal.accountNumber,
          note: withdrawal.adminNote,
        });
      })
      .catch((error) => {
        console.error("Withdrawal status email failed:", error.message);
      });
  }

  private async syncOrdersForSeller(vendorId: string) {
    const orders = await Order.find({
      $or: [{ "fulfillments.vendorId": vendorId }, { "items.vendorId": vendorId }],
    });

    await Promise.all(orders.map((order) => this.syncOrderEarnings(order)));
  }

  async syncOrderEarnings(order: IOrder) {
    const fulfillments = this.getOrderFulfillments(order);

    await Promise.all(
      fulfillments.map(async (fulfillment) => {
        const commissionAmount = Math.round((fulfillment.subtotal * PLATFORM_COMMISSION_RATE) / 100);
        const netAmount = Math.max(fulfillment.subtotal - commissionAmount, 0);
        const status = this.getEarningStatus(order, fulfillment);

        await VendorEarning.findOneAndUpdate(
          {
            orderId: order._id,
            vendorId: fulfillment.vendorId,
          },
          {
            $set: {
              orderNumber: order.orderNumber,
              itemsSubtotal: fulfillment.subtotal,
              commissionRate: PLATFORM_COMMISSION_RATE,
              commissionAmount,
              netAmount,
              paymentMethod: order.paymentMethod,
              status,
              availableAt: status === VendorEarningStatus.AVAILABLE ? fulfillment.updatedAt || new Date() : undefined,
            },
          },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
        );
      })
    );
  }

  private async getSellerBalance(vendorId: string) {
    const [earnings, withdrawals] = await Promise.all([
      VendorEarning.find({ vendorId }),
      WithdrawalRequest.find({ vendorId }),
    ]);

    const pendingEarnings = earnings
      .filter((earning) => earning.status === VendorEarningStatus.PENDING)
      .reduce((total, earning) => total + earning.netAmount, 0);
    const availableEarnings = earnings
      .filter((earning) => earning.status === VendorEarningStatus.AVAILABLE)
      .reduce((total, earning) => total + earning.netAmount, 0);
    const cancelledEarnings = earnings
      .filter((earning) => earning.status === VendorEarningStatus.CANCELLED)
      .reduce((total, earning) => total + earning.netAmount, 0);
    const reservedWithdrawals = withdrawals
      .filter((withdrawal) =>
        [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED, WithdrawalStatus.PROCESSING].includes(withdrawal.status)
      )
      .reduce((total, withdrawal) => total + withdrawal.amount, 0);
    const paidWithdrawals = withdrawals
      .filter((withdrawal) => withdrawal.status === WithdrawalStatus.PAID)
      .reduce((total, withdrawal) => total + withdrawal.amount, 0);
    const grossSales = earnings
      .filter((earning) => earning.status !== VendorEarningStatus.CANCELLED)
      .reduce((total, earning) => total + earning.itemsSubtotal, 0);
    const commission = earnings
      .filter((earning) => earning.status !== VendorEarningStatus.CANCELLED)
      .reduce((total, earning) => total + earning.commissionAmount, 0);
    const netEarnings = earnings
      .filter((earning) => earning.status !== VendorEarningStatus.CANCELLED)
      .reduce((total, earning) => total + earning.netAmount, 0);

    return {
      grossSales,
      commission,
      netEarnings,
      pendingBalance: pendingEarnings,
      availableBalance: Math.max(availableEarnings - reservedWithdrawals - paidWithdrawals, 0),
      reservedBalance: reservedWithdrawals,
      withdrawnBalance: paidWithdrawals,
      cancelledBalance: cancelledEarnings,
    };
  }

  async getSellerOverview(user: CurrentUser) {
    this.ensureSeller(user);
    await this.syncOrdersForSeller(user.id);

    const [balance, recentEarnings, withdrawals] = await Promise.all([
      this.getSellerBalance(user.id),
      VendorEarning.find({ vendorId: user.id }).sort({ createdAt: -1 }).limit(8),
      WithdrawalRequest.find({ vendorId: user.id }).sort({ createdAt: -1 }).limit(8),
    ]);

    return {
      balance,
      commissionRate: PLATFORM_COMMISSION_RATE,
      payoutMode: this.getPayoutMode(),
      minimumWithdrawalAmount: MIN_WITHDRAWAL_AMOUNT,
      recentEarnings: recentEarnings.map((earning) => this.serializeEarning(earning)),
      withdrawals: withdrawals.map((withdrawal) => this.serializeWithdrawal(withdrawal)),
    };
  }

  async listSellerEarnings(user: CurrentUser, query: EarningQuery = {}) {
    this.ensureSeller(user);
    await this.syncOrdersForSeller(user.id);

    const page = toPositiveInteger(query.page, 1);
    const limit = toPositiveInteger(query.limit, 20, 50);
    const filter: Record<string, unknown> = { vendorId: user.id };

    if (query.status && query.status !== "All") {
      filter.status = query.status;
    }

    if (query.search) {
      filter.orderNumber = new RegExp(escapeRegex(query.search), "i");
    }

    const sort = query.sort === "oldest" ? { createdAt: 1 as const } : { createdAt: -1 as const };
    const [earnings, total] = await Promise.all([
      VendorEarning.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
      VendorEarning.countDocuments(filter),
    ]);

    return {
      earnings: earnings.map((earning) => this.serializeEarning(earning)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async requestWithdrawal(user: CurrentUser, payload: WithdrawalPayload) {
    this.ensureSeller(user);
    await this.syncOrdersForSeller(user.id);

    const amount = Number(payload.amount);

    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
      throw new ApiError(400, `Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_AMOUNT}`);
    }

    const bankName = trimValue(payload.bankName);
    const accountNumber = trimValue(payload.accountNumber);
    const accountName = trimValue(payload.accountName);
    const bankCode = trimValue(payload.bankCode);

    if (!bankName || !accountNumber || !accountName) {
      throw new ApiError(400, "Bank name, account number, and account name are required");
    }

    if (this.getPayoutMode() !== "manual" && !bankCode) {
      throw new ApiError(400, "Bank code is required for Paystack transfers");
    }

    const balance = await this.getSellerBalance(user.id);

    if (amount > balance.availableBalance) {
      throw new ApiError(400, "Withdrawal amount exceeds your available balance");
    }

    return WithdrawalRequest.create({
      vendorId: new Types.ObjectId(user.id),
      amount: Math.round(amount),
      bankName,
      bankCode,
      accountNumber,
      accountName,
      vendorNote: trimValue(payload.vendorNote),
      status: WithdrawalStatus.PENDING,
    });
  }

  async listAdminWithdrawals(user: CurrentUser, query: EarningQuery = {}) {
    this.ensureAdmin(user);

    const page = toPositiveInteger(query.page, 1);
    const limit = toPositiveInteger(query.limit, 20, 50);
    const filter: Record<string, unknown> = {};

    if (query.status && query.status !== "All") {
      filter.status = query.status;
    }

    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [
        { bankName: regex },
        { accountName: regex },
        { accountNumber: regex },
        { paystackTransferReference: regex },
      ];
    }

    const sort = query.sort === "oldest" ? { createdAt: 1 as const } : { createdAt: -1 as const };
    const [withdrawals, total] = await Promise.all([
      WithdrawalRequest.find(filter)
        .populate("vendorId", "fullName email")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      WithdrawalRequest.countDocuments(filter),
    ]);

    const allWithdrawals = await WithdrawalRequest.find();
    const pendingAmount = allWithdrawals
      .filter((withdrawal) => [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED].includes(withdrawal.status))
      .reduce((totalAmount, withdrawal) => totalAmount + withdrawal.amount, 0);
    const paidAmount = allWithdrawals
      .filter((withdrawal) => withdrawal.status === WithdrawalStatus.PAID)
      .reduce((totalAmount, withdrawal) => totalAmount + withdrawal.amount, 0);

    return {
      withdrawals: withdrawals.map((withdrawal) => this.serializeWithdrawal(withdrawal)),
      metrics: {
        pendingAmount,
        paidAmount,
        pendingCount: allWithdrawals.filter((withdrawal) => withdrawal.status === WithdrawalStatus.PENDING).length,
        processingCount: allWithdrawals.filter((withdrawal) => withdrawal.status === WithdrawalStatus.PROCESSING).length,
      },
      payoutMode: this.getPayoutMode(),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getAdminSummary(user: CurrentUser) {
    this.ensureAdmin(user);

    const [earnings, withdrawals] = await Promise.all([
      VendorEarning.find(),
      WithdrawalRequest.find(),
    ]);

    return {
      payoutMode: this.getPayoutMode(),
      commissionRate: PLATFORM_COMMISSION_RATE,
      grossSales: earnings
        .filter((earning) => earning.status !== VendorEarningStatus.CANCELLED)
        .reduce((total, earning) => total + earning.itemsSubtotal, 0),
      commission: earnings
        .filter((earning) => earning.status !== VendorEarningStatus.CANCELLED)
        .reduce((total, earning) => total + earning.commissionAmount, 0),
      vendorNet: earnings
        .filter((earning) => earning.status !== VendorEarningStatus.CANCELLED)
        .reduce((total, earning) => total + earning.netAmount, 0),
      pendingWithdrawals: withdrawals
        .filter((withdrawal) => withdrawal.status === WithdrawalStatus.PENDING)
        .reduce((total, withdrawal) => total + withdrawal.amount, 0),
      paidWithdrawals: withdrawals
        .filter((withdrawal) => withdrawal.status === WithdrawalStatus.PAID)
        .reduce((total, withdrawal) => total + withdrawal.amount, 0),
    };
  }

  async approveWithdrawal(user: CurrentUser, withdrawalId: string, payload: AdminWithdrawalPayload = {}) {
    this.ensureAdmin(user);
    this.ensureObjectId(withdrawalId, "withdrawal id");

    const withdrawal = await WithdrawalRequest.findById(withdrawalId);

    if (!withdrawal) {
      throw new ApiError(404, "Withdrawal request not found");
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new ApiError(400, "Only pending withdrawals can be approved");
    }

    withdrawal.status = WithdrawalStatus.APPROVED;
    withdrawal.adminNote = trimValue(payload.note) || withdrawal.adminNote;
    withdrawal.approvedBy = new Types.ObjectId(user.id);
    withdrawal.approvedAt = new Date();
    await withdrawal.save();
    this.sendWithdrawalStatusEmailSafely(withdrawal, "Approved");

    return this.serializeWithdrawal(withdrawal);
  }

  async rejectWithdrawal(user: CurrentUser, withdrawalId: string, payload: AdminWithdrawalPayload = {}) {
    this.ensureAdmin(user);
    this.ensureObjectId(withdrawalId, "withdrawal id");

    const withdrawal = await WithdrawalRequest.findById(withdrawalId);

    if (!withdrawal) {
      throw new ApiError(404, "Withdrawal request not found");
    }

    if (![WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED].includes(withdrawal.status)) {
      throw new ApiError(400, "This withdrawal can no longer be rejected");
    }

    withdrawal.status = WithdrawalStatus.REJECTED;
    withdrawal.adminNote = trimValue(payload.note) || "Rejected by admin";
    await withdrawal.save();
    this.sendWithdrawalStatusEmailSafely(withdrawal, "Rejected");

    return this.serializeWithdrawal(withdrawal);
  }

  async processWithdrawal(user: CurrentUser, withdrawalId: string, payload: AdminWithdrawalPayload = {}) {
    this.ensureAdmin(user);
    this.ensureObjectId(withdrawalId, "withdrawal id");

    const withdrawal = await WithdrawalRequest.findById(withdrawalId);

    if (!withdrawal) {
      throw new ApiError(404, "Withdrawal request not found");
    }

    if (![WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED].includes(withdrawal.status)) {
      throw new ApiError(400, "Only pending or approved withdrawals can be processed");
    }

    const balance = await this.getSellerBalance(withdrawal.vendorId.toString());

    if (withdrawal.amount > balance.availableBalance + withdrawal.amount) {
      throw new ApiError(400, "Vendor no longer has enough available balance");
    }

    withdrawal.adminNote = trimValue(payload.note) || withdrawal.adminNote;
    withdrawal.approvedBy = withdrawal.approvedBy || new Types.ObjectId(user.id);
    withdrawal.approvedAt = withdrawal.approvedAt || new Date();

    if (this.getPayoutMode() === "manual") {
      withdrawal.status = WithdrawalStatus.PAID;
      withdrawal.paidAt = new Date();
      await withdrawal.save();
      this.sendWithdrawalStatusEmailSafely(withdrawal, "Paid");
      return this.serializeWithdrawal(withdrawal);
    }

    if (!withdrawal.bankCode) {
      throw new ApiError(400, "Bank code is required before Paystack payout can run");
    }

    const recipient = await paystack.createTransferRecipient({
      name: withdrawal.accountName,
      accountNumber: withdrawal.accountNumber,
      bankCode: withdrawal.bankCode,
    });
    const reference = generateTransferReference();
    const transfer = await paystack.initiateTransfer({
      amount: Math.round(withdrawal.amount * 100),
      recipient: recipient.recipient_code,
      reason: trimValue(payload.note) || `VendorLink withdrawal ${withdrawal._id}`,
      reference,
    });

    withdrawal.status = WithdrawalStatus.PROCESSING;
    withdrawal.paystackRecipientCode = recipient.recipient_code;
    withdrawal.paystackTransferCode = transfer.transfer_code;
    withdrawal.paystackTransferReference = transfer.reference || reference;
    withdrawal.paystackTransferStatus = transfer.status;
    await withdrawal.save();

    return this.serializeWithdrawal(withdrawal);
  }

  async confirmWithdrawalPaid(user: CurrentUser, withdrawalId: string, payload: AdminWithdrawalPayload = {}) {
    this.ensureAdmin(user);
    this.ensureObjectId(withdrawalId, "withdrawal id");

    const withdrawal = await WithdrawalRequest.findById(withdrawalId);

    if (!withdrawal) {
      throw new ApiError(404, "Withdrawal request not found");
    }

    if (![WithdrawalStatus.APPROVED, WithdrawalStatus.PROCESSING].includes(withdrawal.status)) {
      throw new ApiError(400, "Only approved or processing withdrawals can be confirmed paid");
    }

    withdrawal.status = WithdrawalStatus.PAID;
    withdrawal.adminNote = trimValue(payload.note) || withdrawal.adminNote;
    withdrawal.paidAt = new Date();
    await withdrawal.save();
    this.sendWithdrawalStatusEmailSafely(withdrawal, "Paid");

    return this.serializeWithdrawal(withdrawal);
  }
}

export const earningService = new EarningService();
