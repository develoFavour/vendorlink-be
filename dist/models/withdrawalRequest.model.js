"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WithdrawalRequest = exports.WithdrawalStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var WithdrawalStatus;
(function (WithdrawalStatus) {
    WithdrawalStatus["PENDING"] = "Pending";
    WithdrawalStatus["APPROVED"] = "Approved";
    WithdrawalStatus["PROCESSING"] = "Processing";
    WithdrawalStatus["PAID"] = "Paid";
    WithdrawalStatus["REJECTED"] = "Rejected";
    WithdrawalStatus["FAILED"] = "Failed";
})(WithdrawalStatus || (exports.WithdrawalStatus = WithdrawalStatus = {}));
const withdrawalRequestSchema = new mongoose_1.Schema({
    vendorId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    paidAt: { type: Date },
    paystackRecipientCode: { type: String, trim: true },
    paystackTransferCode: { type: String, trim: true },
    paystackTransferReference: { type: String, trim: true, index: true },
    paystackTransferStatus: { type: String, trim: true },
}, { timestamps: true });
exports.WithdrawalRequest = mongoose_1.default.models.WithdrawalRequest ||
    mongoose_1.default.model("WithdrawalRequest", withdrawalRequestSchema);
