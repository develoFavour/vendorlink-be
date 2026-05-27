"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const review_controller_1 = require("../controllers/review.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_model_1 = require("../models/user.model");
const router = (0, express_1.Router)();
router.get("/products/:productId", review_controller_1.reviewController.listProductReviews);
router.use(auth_middleware_1.protect);
router.get("/admin", (0, auth_middleware_1.authorize)(user_model_1.UserRole.ADMIN), review_controller_1.reviewController.listAdminReviews);
router.patch("/admin/:reviewId/hide", (0, auth_middleware_1.authorize)(user_model_1.UserRole.ADMIN), review_controller_1.reviewController.hideReview);
router.patch("/admin/:reviewId/restore", (0, auth_middleware_1.authorize)(user_model_1.UserRole.ADMIN), review_controller_1.reviewController.restoreReview);
router.delete("/admin/:reviewId", (0, auth_middleware_1.authorize)(user_model_1.UserRole.ADMIN), review_controller_1.reviewController.deleteReviewAsAdmin);
router.get("/products/:productId/eligibility", (0, auth_middleware_1.authorize)(user_model_1.UserRole.BUYER, user_model_1.UserRole.ADMIN), review_controller_1.reviewController.getEligibility);
router.post("/products/:productId", (0, auth_middleware_1.authorize)(user_model_1.UserRole.BUYER, user_model_1.UserRole.ADMIN), review_controller_1.reviewController.createReview);
router
    .route("/products/:productId/me")
    .patch((0, auth_middleware_1.authorize)(user_model_1.UserRole.BUYER, user_model_1.UserRole.ADMIN), review_controller_1.reviewController.updateMyReview)
    .delete((0, auth_middleware_1.authorize)(user_model_1.UserRole.BUYER, user_model_1.UserRole.ADMIN), review_controller_1.reviewController.deleteMyReview);
router.get("/seller", (0, auth_middleware_1.authorize)(user_model_1.UserRole.VENDOR, user_model_1.UserRole.ADMIN), review_controller_1.reviewController.listSellerReviews);
exports.default = router;
