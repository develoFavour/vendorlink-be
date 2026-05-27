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
exports.RefundRequest = exports.RefundRequestStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const order_model_1 = require("./order.model");
var RefundRequestStatus;
(function (RefundRequestStatus) {
    RefundRequestStatus["PENDING"] = "Pending";
    RefundRequestStatus["APPROVED"] = "Approved";
    RefundRequestStatus["REJECTED"] = "Rejected";
    RefundRequestStatus["REFUNDED"] = "Refunded";
})(RefundRequestStatus || (exports.RefundRequestStatus = RefundRequestStatus = {}));
const refundRequestSchema = new mongoose_1.Schema({
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    buyerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
        enum: Object.values(order_model_1.PaymentMethod),
        required: true,
    },
}, { timestamps: true });
refundRequestSchema.index({ orderId: 1, buyerId: 1, status: 1 }, { partialFilterExpression: { status: RefundRequestStatus.PENDING } });
exports.RefundRequest = mongoose_1.default.models.RefundRequest ||
    mongoose_1.default.model("RefundRequest", refundRequestSchema);
