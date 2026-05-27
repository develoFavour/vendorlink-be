"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.earningService = void 0;
const mongoose_1 = require("mongoose");
const order_model_1 = require("../models/order.model");
const user_model_1 = require("../models/user.model");
const vendorEarning_model_1 = require("../models/vendorEarning.model");
const withdrawalRequest_model_1 = require("../models/withdrawalRequest.model");
const ApiError_1 = require("../utils/ApiError");
const email_1 = require("../utils/email");
const paystack_1 = require("../utils/paystack");
const PLATFORM_COMMISSION_RATE = Number(process.env.PLATFORM_COMMISSION_RATE || 10);
const MIN_WITHDRAWAL_AMOUNT = Number(process.env.MIN_WITHDRAWAL_AMOUNT || 1000);
const trimValue = (value) => (typeof value === "string" ? value.trim() : "");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toPositiveInteger = (value, fallback, max = 100) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1)
        return fallback;
    return Math.min(parsed, max);
};
const generateTransferReference = () => `VL-TRF-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
class EarningService {
    ensureSeller(user) {
        if (user.role !== user_model_1.UserRole.VENDOR && user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only sellers can access earnings");
        }
    }
    ensureAdmin(user) {
        if (user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only admins can manage withdrawals");
        }
    }
    ensureObjectId(id, label) {
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            throw new ApiError_1.ApiError(400, `Invalid ${label}`);
        }
    }
    getPayoutMode() {
        return (process.env.PAYOUT_MODE || "manual").toLowerCase();
    }
    getEarningStatus(order, fulfillment) {
        if (fulfillment.status === order_model_1.OrderStatus.CANCELLED || order.status === order_model_1.OrderStatus.CANCELLED) {
            return vendorEarning_model_1.VendorEarningStatus.CANCELLED;
        }
        if (order.paymentStatus === order_model_1.PaymentStatus.FAILED) {
            return vendorEarning_model_1.VendorEarningStatus.CANCELLED;
        }
        if (fulfillment.status === order_model_1.OrderStatus.DELIVERED && order.paymentStatus === order_model_1.PaymentStatus.PAID) {
            return vendorEarning_model_1.VendorEarningStatus.AVAILABLE;
        }
        return vendorEarning_model_1.VendorEarningStatus.PENDING;
    }
    getOrderFulfillments(order) {
        var _a;
        if ((_a = order.fulfillments) === null || _a === void 0 ? void 0 : _a.length)
            return order.fulfillments;
        const grouped = new Map();
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
    serializeEarning(earning) {
        const plain = earning.toObject ? earning.toObject() : earning;
        return plain;
    }
    serializeWithdrawal(withdrawal) {
        const plain = withdrawal.toObject ? withdrawal.toObject() : withdrawal;
        const vendor = plain.vendorId;
        return Object.assign(Object.assign({}, plain), { vendorName: vendor === null || vendor === void 0 ? void 0 : vendor.fullName, vendorEmail: vendor === null || vendor === void 0 ? void 0 : vendor.email, vendorId: (vendor === null || vendor === void 0 ? void 0 : vendor._id) || plain.vendorId });
    }
    sendWithdrawalStatusEmailSafely(withdrawal, status) {
        user_model_1.User.findById(withdrawal.vendorId)
            .then((vendor) => {
            if (!vendor)
                return;
            return (0, email_1.sendWithdrawalStatusEmail)({
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
    syncOrdersForSeller(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            const orders = yield order_model_1.Order.find({
                $or: [{ "fulfillments.vendorId": vendorId }, { "items.vendorId": vendorId }],
            });
            yield Promise.all(orders.map((order) => this.syncOrderEarnings(order)));
        });
    }
    syncOrderEarnings(order) {
        return __awaiter(this, void 0, void 0, function* () {
            const fulfillments = this.getOrderFulfillments(order);
            yield Promise.all(fulfillments.map((fulfillment) => __awaiter(this, void 0, void 0, function* () {
                const commissionAmount = Math.round((fulfillment.subtotal * PLATFORM_COMMISSION_RATE) / 100);
                const netAmount = Math.max(fulfillment.subtotal - commissionAmount, 0);
                const status = this.getEarningStatus(order, fulfillment);
                yield vendorEarning_model_1.VendorEarning.findOneAndUpdate({
                    orderId: order._id,
                    vendorId: fulfillment.vendorId,
                }, {
                    $set: {
                        orderNumber: order.orderNumber,
                        itemsSubtotal: fulfillment.subtotal,
                        commissionRate: PLATFORM_COMMISSION_RATE,
                        commissionAmount,
                        netAmount,
                        paymentMethod: order.paymentMethod,
                        status,
                        availableAt: status === vendorEarning_model_1.VendorEarningStatus.AVAILABLE ? fulfillment.updatedAt || new Date() : undefined,
                    },
                }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
            })));
        });
    }
    getSellerBalance(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            const [earnings, withdrawals] = yield Promise.all([
                vendorEarning_model_1.VendorEarning.find({ vendorId }),
                withdrawalRequest_model_1.WithdrawalRequest.find({ vendorId }),
            ]);
            const pendingEarnings = earnings
                .filter((earning) => earning.status === vendorEarning_model_1.VendorEarningStatus.PENDING)
                .reduce((total, earning) => total + earning.netAmount, 0);
            const availableEarnings = earnings
                .filter((earning) => earning.status === vendorEarning_model_1.VendorEarningStatus.AVAILABLE)
                .reduce((total, earning) => total + earning.netAmount, 0);
            const cancelledEarnings = earnings
                .filter((earning) => earning.status === vendorEarning_model_1.VendorEarningStatus.CANCELLED)
                .reduce((total, earning) => total + earning.netAmount, 0);
            const reservedWithdrawals = withdrawals
                .filter((withdrawal) => [withdrawalRequest_model_1.WithdrawalStatus.PENDING, withdrawalRequest_model_1.WithdrawalStatus.APPROVED, withdrawalRequest_model_1.WithdrawalStatus.PROCESSING].includes(withdrawal.status))
                .reduce((total, withdrawal) => total + withdrawal.amount, 0);
            const paidWithdrawals = withdrawals
                .filter((withdrawal) => withdrawal.status === withdrawalRequest_model_1.WithdrawalStatus.PAID)
                .reduce((total, withdrawal) => total + withdrawal.amount, 0);
            const grossSales = earnings
                .filter((earning) => earning.status !== vendorEarning_model_1.VendorEarningStatus.CANCELLED)
                .reduce((total, earning) => total + earning.itemsSubtotal, 0);
            const commission = earnings
                .filter((earning) => earning.status !== vendorEarning_model_1.VendorEarningStatus.CANCELLED)
                .reduce((total, earning) => total + earning.commissionAmount, 0);
            const netEarnings = earnings
                .filter((earning) => earning.status !== vendorEarning_model_1.VendorEarningStatus.CANCELLED)
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
        });
    }
    getSellerOverview(user) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureSeller(user);
            yield this.syncOrdersForSeller(user.id);
            const [balance, recentEarnings, withdrawals] = yield Promise.all([
                this.getSellerBalance(user.id),
                vendorEarning_model_1.VendorEarning.find({ vendorId: user.id }).sort({ createdAt: -1 }).limit(8),
                withdrawalRequest_model_1.WithdrawalRequest.find({ vendorId: user.id }).sort({ createdAt: -1 }).limit(8),
            ]);
            return {
                balance,
                commissionRate: PLATFORM_COMMISSION_RATE,
                payoutMode: this.getPayoutMode(),
                minimumWithdrawalAmount: MIN_WITHDRAWAL_AMOUNT,
                recentEarnings: recentEarnings.map((earning) => this.serializeEarning(earning)),
                withdrawals: withdrawals.map((withdrawal) => this.serializeWithdrawal(withdrawal)),
            };
        });
    }
    listSellerEarnings(user_1) {
        return __awaiter(this, arguments, void 0, function* (user, query = {}) {
            this.ensureSeller(user);
            yield this.syncOrdersForSeller(user.id);
            const page = toPositiveInteger(query.page, 1);
            const limit = toPositiveInteger(query.limit, 20, 50);
            const filter = { vendorId: user.id };
            if (query.status && query.status !== "All") {
                filter.status = query.status;
            }
            if (query.search) {
                filter.orderNumber = new RegExp(escapeRegex(query.search), "i");
            }
            const sort = query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
            const [earnings, total] = yield Promise.all([
                vendorEarning_model_1.VendorEarning.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
                vendorEarning_model_1.VendorEarning.countDocuments(filter),
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
        });
    }
    requestWithdrawal(user, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureSeller(user);
            yield this.syncOrdersForSeller(user.id);
            const amount = Number(payload.amount);
            if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
                throw new ApiError_1.ApiError(400, `Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_AMOUNT}`);
            }
            const bankName = trimValue(payload.bankName);
            const accountNumber = trimValue(payload.accountNumber);
            const accountName = trimValue(payload.accountName);
            const bankCode = trimValue(payload.bankCode);
            if (!bankName || !accountNumber || !accountName) {
                throw new ApiError_1.ApiError(400, "Bank name, account number, and account name are required");
            }
            if (this.getPayoutMode() !== "manual" && !bankCode) {
                throw new ApiError_1.ApiError(400, "Bank code is required for Paystack transfers");
            }
            const balance = yield this.getSellerBalance(user.id);
            if (amount > balance.availableBalance) {
                throw new ApiError_1.ApiError(400, "Withdrawal amount exceeds your available balance");
            }
            return withdrawalRequest_model_1.WithdrawalRequest.create({
                vendorId: new mongoose_1.Types.ObjectId(user.id),
                amount: Math.round(amount),
                bankName,
                bankCode,
                accountNumber,
                accountName,
                vendorNote: trimValue(payload.vendorNote),
                status: withdrawalRequest_model_1.WithdrawalStatus.PENDING,
            });
        });
    }
    listAdminWithdrawals(user_1) {
        return __awaiter(this, arguments, void 0, function* (user, query = {}) {
            this.ensureAdmin(user);
            const page = toPositiveInteger(query.page, 1);
            const limit = toPositiveInteger(query.limit, 20, 50);
            const filter = {};
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
            const sort = query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
            const [withdrawals, total] = yield Promise.all([
                withdrawalRequest_model_1.WithdrawalRequest.find(filter)
                    .populate("vendorId", "fullName email")
                    .sort(sort)
                    .skip((page - 1) * limit)
                    .limit(limit),
                withdrawalRequest_model_1.WithdrawalRequest.countDocuments(filter),
            ]);
            const allWithdrawals = yield withdrawalRequest_model_1.WithdrawalRequest.find();
            const pendingAmount = allWithdrawals
                .filter((withdrawal) => [withdrawalRequest_model_1.WithdrawalStatus.PENDING, withdrawalRequest_model_1.WithdrawalStatus.APPROVED].includes(withdrawal.status))
                .reduce((totalAmount, withdrawal) => totalAmount + withdrawal.amount, 0);
            const paidAmount = allWithdrawals
                .filter((withdrawal) => withdrawal.status === withdrawalRequest_model_1.WithdrawalStatus.PAID)
                .reduce((totalAmount, withdrawal) => totalAmount + withdrawal.amount, 0);
            return {
                withdrawals: withdrawals.map((withdrawal) => this.serializeWithdrawal(withdrawal)),
                metrics: {
                    pendingAmount,
                    paidAmount,
                    pendingCount: allWithdrawals.filter((withdrawal) => withdrawal.status === withdrawalRequest_model_1.WithdrawalStatus.PENDING).length,
                    processingCount: allWithdrawals.filter((withdrawal) => withdrawal.status === withdrawalRequest_model_1.WithdrawalStatus.PROCESSING).length,
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
        });
    }
    getAdminSummary(user) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureAdmin(user);
            const [earnings, withdrawals] = yield Promise.all([
                vendorEarning_model_1.VendorEarning.find(),
                withdrawalRequest_model_1.WithdrawalRequest.find(),
            ]);
            return {
                payoutMode: this.getPayoutMode(),
                commissionRate: PLATFORM_COMMISSION_RATE,
                grossSales: earnings
                    .filter((earning) => earning.status !== vendorEarning_model_1.VendorEarningStatus.CANCELLED)
                    .reduce((total, earning) => total + earning.itemsSubtotal, 0),
                commission: earnings
                    .filter((earning) => earning.status !== vendorEarning_model_1.VendorEarningStatus.CANCELLED)
                    .reduce((total, earning) => total + earning.commissionAmount, 0),
                vendorNet: earnings
                    .filter((earning) => earning.status !== vendorEarning_model_1.VendorEarningStatus.CANCELLED)
                    .reduce((total, earning) => total + earning.netAmount, 0),
                pendingWithdrawals: withdrawals
                    .filter((withdrawal) => withdrawal.status === withdrawalRequest_model_1.WithdrawalStatus.PENDING)
                    .reduce((total, withdrawal) => total + withdrawal.amount, 0),
                paidWithdrawals: withdrawals
                    .filter((withdrawal) => withdrawal.status === withdrawalRequest_model_1.WithdrawalStatus.PAID)
                    .reduce((total, withdrawal) => total + withdrawal.amount, 0),
            };
        });
    }
    approveWithdrawal(user_1, withdrawalId_1) {
        return __awaiter(this, arguments, void 0, function* (user, withdrawalId, payload = {}) {
            this.ensureAdmin(user);
            this.ensureObjectId(withdrawalId, "withdrawal id");
            const withdrawal = yield withdrawalRequest_model_1.WithdrawalRequest.findById(withdrawalId);
            if (!withdrawal) {
                throw new ApiError_1.ApiError(404, "Withdrawal request not found");
            }
            if (withdrawal.status !== withdrawalRequest_model_1.WithdrawalStatus.PENDING) {
                throw new ApiError_1.ApiError(400, "Only pending withdrawals can be approved");
            }
            withdrawal.status = withdrawalRequest_model_1.WithdrawalStatus.APPROVED;
            withdrawal.adminNote = trimValue(payload.note) || withdrawal.adminNote;
            withdrawal.approvedBy = new mongoose_1.Types.ObjectId(user.id);
            withdrawal.approvedAt = new Date();
            yield withdrawal.save();
            this.sendWithdrawalStatusEmailSafely(withdrawal, "Approved");
            return this.serializeWithdrawal(withdrawal);
        });
    }
    rejectWithdrawal(user_1, withdrawalId_1) {
        return __awaiter(this, arguments, void 0, function* (user, withdrawalId, payload = {}) {
            this.ensureAdmin(user);
            this.ensureObjectId(withdrawalId, "withdrawal id");
            const withdrawal = yield withdrawalRequest_model_1.WithdrawalRequest.findById(withdrawalId);
            if (!withdrawal) {
                throw new ApiError_1.ApiError(404, "Withdrawal request not found");
            }
            if (![withdrawalRequest_model_1.WithdrawalStatus.PENDING, withdrawalRequest_model_1.WithdrawalStatus.APPROVED].includes(withdrawal.status)) {
                throw new ApiError_1.ApiError(400, "This withdrawal can no longer be rejected");
            }
            withdrawal.status = withdrawalRequest_model_1.WithdrawalStatus.REJECTED;
            withdrawal.adminNote = trimValue(payload.note) || "Rejected by admin";
            yield withdrawal.save();
            this.sendWithdrawalStatusEmailSafely(withdrawal, "Rejected");
            return this.serializeWithdrawal(withdrawal);
        });
    }
    processWithdrawal(user_1, withdrawalId_1) {
        return __awaiter(this, arguments, void 0, function* (user, withdrawalId, payload = {}) {
            this.ensureAdmin(user);
            this.ensureObjectId(withdrawalId, "withdrawal id");
            const withdrawal = yield withdrawalRequest_model_1.WithdrawalRequest.findById(withdrawalId);
            if (!withdrawal) {
                throw new ApiError_1.ApiError(404, "Withdrawal request not found");
            }
            if (![withdrawalRequest_model_1.WithdrawalStatus.PENDING, withdrawalRequest_model_1.WithdrawalStatus.APPROVED].includes(withdrawal.status)) {
                throw new ApiError_1.ApiError(400, "Only pending or approved withdrawals can be processed");
            }
            const balance = yield this.getSellerBalance(withdrawal.vendorId.toString());
            if (withdrawal.amount > balance.availableBalance + withdrawal.amount) {
                throw new ApiError_1.ApiError(400, "Vendor no longer has enough available balance");
            }
            withdrawal.adminNote = trimValue(payload.note) || withdrawal.adminNote;
            withdrawal.approvedBy = withdrawal.approvedBy || new mongoose_1.Types.ObjectId(user.id);
            withdrawal.approvedAt = withdrawal.approvedAt || new Date();
            if (this.getPayoutMode() === "manual") {
                withdrawal.status = withdrawalRequest_model_1.WithdrawalStatus.PAID;
                withdrawal.paidAt = new Date();
                yield withdrawal.save();
                this.sendWithdrawalStatusEmailSafely(withdrawal, "Paid");
                return this.serializeWithdrawal(withdrawal);
            }
            if (!withdrawal.bankCode) {
                throw new ApiError_1.ApiError(400, "Bank code is required before Paystack payout can run");
            }
            const recipient = yield paystack_1.paystack.createTransferRecipient({
                name: withdrawal.accountName,
                accountNumber: withdrawal.accountNumber,
                bankCode: withdrawal.bankCode,
            });
            const reference = generateTransferReference();
            const transfer = yield paystack_1.paystack.initiateTransfer({
                amount: Math.round(withdrawal.amount * 100),
                recipient: recipient.recipient_code,
                reason: trimValue(payload.note) || `VendorLink withdrawal ${withdrawal._id}`,
                reference,
            });
            withdrawal.status = withdrawalRequest_model_1.WithdrawalStatus.PROCESSING;
            withdrawal.paystackRecipientCode = recipient.recipient_code;
            withdrawal.paystackTransferCode = transfer.transfer_code;
            withdrawal.paystackTransferReference = transfer.reference || reference;
            withdrawal.paystackTransferStatus = transfer.status;
            yield withdrawal.save();
            return this.serializeWithdrawal(withdrawal);
        });
    }
    confirmWithdrawalPaid(user_1, withdrawalId_1) {
        return __awaiter(this, arguments, void 0, function* (user, withdrawalId, payload = {}) {
            this.ensureAdmin(user);
            this.ensureObjectId(withdrawalId, "withdrawal id");
            const withdrawal = yield withdrawalRequest_model_1.WithdrawalRequest.findById(withdrawalId);
            if (!withdrawal) {
                throw new ApiError_1.ApiError(404, "Withdrawal request not found");
            }
            if (![withdrawalRequest_model_1.WithdrawalStatus.APPROVED, withdrawalRequest_model_1.WithdrawalStatus.PROCESSING].includes(withdrawal.status)) {
                throw new ApiError_1.ApiError(400, "Only approved or processing withdrawals can be confirmed paid");
            }
            withdrawal.status = withdrawalRequest_model_1.WithdrawalStatus.PAID;
            withdrawal.adminNote = trimValue(payload.note) || withdrawal.adminNote;
            withdrawal.paidAt = new Date();
            yield withdrawal.save();
            this.sendWithdrawalStatusEmailSafely(withdrawal, "Paid");
            return this.serializeWithdrawal(withdrawal);
        });
    }
}
exports.earningService = new EarningService();
