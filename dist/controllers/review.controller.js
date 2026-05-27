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
exports.reviewController = void 0;
const review_service_1 = require("../services/review.service");
const review_model_1 = require("../models/review.model");
const ApiResponse_1 = require("../utils/ApiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
class ReviewController {
    constructor() {
        this.listProductReviews = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield review_service_1.reviewService.listProductReviews(this.getProductId(req), req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Reviews fetched successfully"));
        }));
        this.getEligibility = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield review_service_1.reviewService.getEligibility(req.user, this.getProductId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Review eligibility fetched successfully"));
        }));
        this.createReview = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const review = yield review_service_1.reviewService.createReview(req.user, this.getProductId(req), req.body);
            return res.status(201).json(new ApiResponse_1.ApiResponse(201, review, "Review submitted successfully"));
        }));
        this.updateMyReview = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const review = yield review_service_1.reviewService.updateMyReview(req.user, this.getProductId(req), req.body);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, review, "Review updated successfully"));
        }));
        this.deleteMyReview = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            yield review_service_1.reviewService.deleteMyReview(req.user, this.getProductId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, null, "Review deleted successfully"));
        }));
        this.listSellerReviews = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield review_service_1.reviewService.listSellerReviews(req.user, req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Seller reviews fetched successfully"));
        }));
        this.listAdminReviews = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield review_service_1.reviewService.listAdminReviews(req.user, req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Admin reviews fetched successfully"));
        }));
        this.hideReview = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const review = yield review_service_1.reviewService.updateReviewModerationStatus(req.user, this.getReviewId(req), review_model_1.ReviewModerationStatus.HIDDEN, req.body);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, review, "Review hidden successfully"));
        }));
        this.restoreReview = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const review = yield review_service_1.reviewService.updateReviewModerationStatus(req.user, this.getReviewId(req), review_model_1.ReviewModerationStatus.VISIBLE, req.body);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, review, "Review restored successfully"));
        }));
        this.deleteReviewAsAdmin = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            yield review_service_1.reviewService.deleteReviewAsAdmin(req.user, this.getReviewId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, null, "Review deleted successfully"));
        }));
    }
    getProductId(req) {
        const productId = req.params.productId;
        return Array.isArray(productId) ? productId[0] : productId;
    }
    getReviewId(req) {
        const reviewId = req.params.reviewId;
        return Array.isArray(reviewId) ? reviewId[0] : reviewId;
    }
}
exports.reviewController = new ReviewController();
