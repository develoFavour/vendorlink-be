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
exports.reviewService = void 0;
const mongoose_1 = require("mongoose");
const order_model_1 = require("../models/order.model");
const product_model_1 = require("../models/product.model");
const review_model_1 = require("../models/review.model");
const user_model_1 = require("../models/user.model");
const ApiError_1 = require("../utils/ApiError");
const trimValue = (value) => (typeof value === "string" ? value.trim() : "");
const toPositiveInteger = (value, fallback, max = 100) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1)
        return fallback;
    return Math.min(parsed, max);
};
const emptyDistribution = () => ({
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
});
const visibleReviewFilter = {
    $or: [
        { moderationStatus: review_model_1.ReviewModerationStatus.VISIBLE },
        { moderationStatus: { $exists: false } },
    ],
};
class ReviewService {
    ensureBuyer(user) {
        if (user.role !== user_model_1.UserRole.BUYER && user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only buyers can review products");
        }
    }
    ensureSeller(user) {
        if (user.role !== user_model_1.UserRole.VENDOR && user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only sellers can view seller ratings");
        }
    }
    ensureAdmin(user) {
        if (user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only admins can moderate ratings");
        }
    }
    ensureValidObjectId(value, label) {
        if (!mongoose_1.Types.ObjectId.isValid(value)) {
            throw new ApiError_1.ApiError(400, `Invalid ${label}`);
        }
    }
    parsePayload(payload) {
        const rating = Number(payload.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            throw new ApiError_1.ApiError(400, "Please select a rating from 1 to 5");
        }
        return {
            rating,
            title: trimValue(payload.title),
            comment: trimValue(payload.comment),
        };
    }
    getProductOrThrow(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureValidObjectId(productId, "product id");
            const product = yield product_model_1.Product.findById(productId);
            if (!product || product.status !== product_model_1.ProductStatus.PUBLISHED) {
                throw new ApiError_1.ApiError(404, "Product not found");
            }
            return product;
        });
    }
    getDeliveredPurchase(user, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const order = yield order_model_1.Order.findOne({
                buyerId: user.id,
                "items.productId": productId,
            }).sort({ createdAt: -1 });
            if (!order)
                return null;
            const fulfillment = (_a = order.fulfillments) === null || _a === void 0 ? void 0 : _a.find((item) => item.items.some((orderItem) => orderItem.productId.toString() === productId));
            const delivered = fulfillment
                ? fulfillment.status === order_model_1.OrderStatus.DELIVERED
                : order.status === order_model_1.OrderStatus.DELIVERED;
            return delivered ? order : null;
        });
    }
    buildSummary(productIds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!productIds.length) {
                return {
                    averageRating: 0,
                    totalReviews: 0,
                    distribution: emptyDistribution(),
                };
            }
            const stats = yield review_model_1.Review.aggregate([
                { $match: Object.assign({ productId: { $in: productIds } }, visibleReviewFilter) },
                { $group: { _id: "$rating", count: { $sum: 1 } } },
            ]);
            const distribution = emptyDistribution();
            let totalReviews = 0;
            let ratingTotal = 0;
            stats.forEach((item) => {
                const key = String(item._id);
                distribution[key] = item.count;
                totalReviews += item.count;
                ratingTotal += item._id * item.count;
            });
            return {
                averageRating: totalReviews ? Number((ratingTotal / totalReviews).toFixed(1)) : 0,
                totalReviews,
                distribution,
            };
        });
    }
    serializeReview(review) {
        const plain = review.toObject ? review.toObject() : review;
        const buyer = plain.buyerId;
        const product = plain.productId;
        return {
            _id: plain._id,
            productId: product,
            buyerId: buyer,
            buyerName: buyer && typeof buyer === "object" && "fullName" in buyer
                ? buyer.fullName || "Verified buyer"
                : "Verified buyer",
            product: product && typeof product === "object" && "name" in product
                ? {
                    _id: product._id,
                    name: product.name,
                    image: product.image,
                    price: product.price,
                    category: product.category,
                }
                : undefined,
            orderId: plain.orderId,
            rating: plain.rating,
            title: plain.title || "",
            comment: plain.comment || "",
            isVerifiedPurchase: plain.isVerifiedPurchase,
            moderationStatus: plain.moderationStatus || review_model_1.ReviewModerationStatus.VISIBLE,
            hiddenReason: plain.hiddenReason || "",
            createdAt: plain.createdAt,
            updatedAt: plain.updatedAt,
        };
    }
    listProductReviews(productId_1) {
        return __awaiter(this, arguments, void 0, function* (productId, query = {}) {
            yield this.getProductOrThrow(productId);
            const page = toPositiveInteger(query.page, 1);
            const limit = toPositiveInteger(query.limit, 8, 50);
            const filter = Object.assign({ productId }, visibleReviewFilter);
            if (query.rating) {
                const rating = Number(query.rating);
                if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
                    filter.rating = rating;
                }
            }
            const productObjectId = new mongoose_1.Types.ObjectId(productId);
            const [reviews, total, summary] = yield Promise.all([
                review_model_1.Review.find(filter)
                    .populate("buyerId", "fullName")
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit),
                review_model_1.Review.countDocuments(filter),
                this.buildSummary([productObjectId]),
            ]);
            return {
                summary,
                reviews: reviews.map((review) => this.serializeReview(review)),
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
    getEligibility(user, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            const product = yield this.getProductOrThrow(productId);
            if (product.vendorId.toString() === user.id) {
                return {
                    canReview: false,
                    reason: "You cannot review your own product",
                    existingReview: null,
                };
            }
            const existingReview = yield review_model_1.Review.findOne({ productId, buyerId: user.id });
            const purchaseOrder = yield this.getDeliveredPurchase(user, productId);
            if (!purchaseOrder) {
                return {
                    canReview: false,
                    reason: "Only delivered purchases can be reviewed",
                    existingReview: existingReview ? this.serializeReview(existingReview) : null,
                };
            }
            return {
                canReview: true,
                reason: existingReview ? "You can update your review" : "You can review this product",
                orderId: purchaseOrder._id,
                existingReview: existingReview ? this.serializeReview(existingReview) : null,
            };
        });
    }
    createReview(user, productId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const eligibility = yield this.getEligibility(user, productId);
            if (!eligibility.canReview || !eligibility.orderId) {
                throw new ApiError_1.ApiError(403, eligibility.reason || "You are not allowed to review this product");
            }
            if (eligibility.existingReview) {
                throw new ApiError_1.ApiError(409, "You have already reviewed this product");
            }
            const parsed = this.parsePayload(payload);
            const review = yield review_model_1.Review.create({
                productId,
                buyerId: user.id,
                orderId: eligibility.orderId,
                rating: parsed.rating,
                title: parsed.title,
                comment: parsed.comment,
                isVerifiedPurchase: true,
            });
            return this.serializeReview(review);
        });
    }
    updateMyReview(user, productId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getProductOrThrow(productId);
            this.ensureBuyer(user);
            const review = yield review_model_1.Review.findOne({ productId, buyerId: user.id });
            if (!review) {
                throw new ApiError_1.ApiError(404, "Review not found");
            }
            const parsed = this.parsePayload(payload);
            review.rating = parsed.rating;
            review.title = parsed.title;
            review.comment = parsed.comment;
            yield review.save();
            return this.serializeReview(review);
        });
    }
    deleteMyReview(user, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getProductOrThrow(productId);
            this.ensureBuyer(user);
            const review = yield review_model_1.Review.findOneAndDelete({ productId, buyerId: user.id });
            if (!review) {
                throw new ApiError_1.ApiError(404, "Review not found");
            }
            return null;
        });
    }
    listSellerReviews(user_1) {
        return __awaiter(this, arguments, void 0, function* (user, query = {}) {
            this.ensureSeller(user);
            const page = toPositiveInteger(query.page, 1);
            const limit = toPositiveInteger(query.limit, 12, 50);
            const productFilter = user.role === user_model_1.UserRole.ADMIN ? {} : { vendorId: user.id };
            const products = yield product_model_1.Product.find(productFilter).select("_id name image price category");
            const productIds = products.map((product) => product._id);
            const filter = Object.assign({ productId: { $in: productIds } }, visibleReviewFilter);
            if (query.rating) {
                const rating = Number(query.rating);
                if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
                    filter.rating = rating;
                }
            }
            const [reviews, total, summary] = yield Promise.all([
                review_model_1.Review.find(filter)
                    .populate("buyerId", "fullName")
                    .populate("productId", "name image price category")
                    .sort({ createdAt: -1 })
                    .skip((page - 1) * limit)
                    .limit(limit),
                review_model_1.Review.countDocuments(filter),
                this.buildSummary(productIds),
            ]);
            return {
                summary,
                reviews: reviews.map((review) => this.serializeReview(review)),
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
    listAdminReviews(user_1) {
        return __awaiter(this, arguments, void 0, function* (user, query = {}) {
            this.ensureAdmin(user);
            const page = toPositiveInteger(query.page, 1);
            const limit = toPositiveInteger(query.limit, 20, 50);
            const filter = {};
            if (query.status && query.status !== "All") {
                filter.moderationStatus = query.status;
            }
            if (query.rating) {
                const rating = Number(query.rating);
                if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
                    filter.rating = rating;
                }
            }
            if (query.search) {
                const regex = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
                const [products, buyers] = yield Promise.all([
                    product_model_1.Product.find({
                        $or: [{ name: regex }, { brand: regex }, { category: regex }, { sku: regex }],
                    }).select("_id"),
                    user_model_1.User.find({
                        $or: [{ fullName: regex }, { email: regex }],
                    }).select("_id"),
                ]);
                filter.$or = [
                    { title: regex },
                    { comment: regex },
                    { productId: { $in: products.map((product) => product._id) } },
                    { buyerId: { $in: buyers.map((buyer) => buyer._id) } },
                ];
            }
            let sort = { createdAt: -1 };
            if (query.sort === "oldest") {
                sort = { createdAt: 1 };
            }
            else if (query.sort === "rating_high") {
                sort = { rating: -1 };
            }
            else if (query.sort === "rating_low") {
                sort = { rating: 1 };
            }
            const [reviews, total, summary] = yield Promise.all([
                review_model_1.Review.find(filter)
                    .populate("buyerId", "fullName email")
                    .populate("productId", "name image price category")
                    .sort(sort)
                    .skip((page - 1) * limit)
                    .limit(limit),
                review_model_1.Review.countDocuments(filter),
                this.buildSummary((yield product_model_1.Product.find().select("_id")).map((product) => product._id)),
            ]);
            return {
                summary,
                reviews: reviews.map((review) => this.serializeReview(review)),
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
    updateReviewModerationStatus(user_1, reviewId_1, status_1) {
        return __awaiter(this, arguments, void 0, function* (user, reviewId, status, payload = {}) {
            this.ensureAdmin(user);
            this.ensureValidObjectId(reviewId, "review id");
            const review = yield review_model_1.Review.findById(reviewId);
            if (!review) {
                throw new ApiError_1.ApiError(404, "Review not found");
            }
            review.moderationStatus = status;
            review.hiddenReason =
                status === review_model_1.ReviewModerationStatus.HIDDEN ? trimValue(payload.reason) || "Hidden by admin" : undefined;
            review.moderatedBy = new mongoose_1.Types.ObjectId(user.id);
            review.moderatedAt = new Date();
            yield review.save();
            yield review.populate("buyerId", "fullName email");
            yield review.populate("productId", "name image price category");
            return this.serializeReview(review);
        });
    }
    deleteReviewAsAdmin(user, reviewId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureAdmin(user);
            this.ensureValidObjectId(reviewId, "review id");
            const review = yield review_model_1.Review.findByIdAndDelete(reviewId);
            if (!review) {
                throw new ApiError_1.ApiError(404, "Review not found");
            }
            return null;
        });
    }
}
exports.reviewService = new ReviewService();
