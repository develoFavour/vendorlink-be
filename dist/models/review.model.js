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
exports.Review = exports.ReviewModerationStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ReviewModerationStatus;
(function (ReviewModerationStatus) {
    ReviewModerationStatus["VISIBLE"] = "VISIBLE";
    ReviewModerationStatus["HIDDEN"] = "HIDDEN";
})(ReviewModerationStatus || (exports.ReviewModerationStatus = ReviewModerationStatus = {}));
const reviewSchema = new mongoose_1.Schema({
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        index: true,
    },
    buyerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    orderId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Order",
        required: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    title: {
        type: String,
        trim: true,
        maxlength: 120,
    },
    comment: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
    isVerifiedPurchase: {
        type: Boolean,
        default: true,
    },
    moderationStatus: {
        type: String,
        enum: Object.values(ReviewModerationStatus),
        default: ReviewModerationStatus.VISIBLE,
        index: true,
    },
    hiddenReason: {
        type: String,
        trim: true,
        maxlength: 240,
    },
    moderatedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    moderatedAt: {
        type: Date,
    },
}, { timestamps: true });
reviewSchema.index({ productId: 1, buyerId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, rating: 1 });
exports.Review = mongoose_1.default.models.Review || mongoose_1.default.model("Review", reviewSchema);
