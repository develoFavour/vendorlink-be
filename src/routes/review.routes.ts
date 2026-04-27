import { Router } from "express";
import { reviewController } from "../controllers/review.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router();

router.get("/products/:productId", reviewController.listProductReviews);

router.use(protect);

router.get(
  "/admin",
  authorize(UserRole.ADMIN),
  reviewController.listAdminReviews
);
router.patch(
  "/admin/:reviewId/hide",
  authorize(UserRole.ADMIN),
  reviewController.hideReview
);
router.patch(
  "/admin/:reviewId/restore",
  authorize(UserRole.ADMIN),
  reviewController.restoreReview
);
router.delete(
  "/admin/:reviewId",
  authorize(UserRole.ADMIN),
  reviewController.deleteReviewAsAdmin
);

router.get(
  "/products/:productId/eligibility",
  authorize(UserRole.BUYER, UserRole.ADMIN),
  reviewController.getEligibility
);
router.post(
  "/products/:productId",
  authorize(UserRole.BUYER, UserRole.ADMIN),
  reviewController.createReview
);
router
  .route("/products/:productId/me")
  .patch(authorize(UserRole.BUYER, UserRole.ADMIN), reviewController.updateMyReview)
  .delete(authorize(UserRole.BUYER, UserRole.ADMIN), reviewController.deleteMyReview);

router.get(
  "/seller",
  authorize(UserRole.VENDOR, UserRole.ADMIN),
  reviewController.listSellerReviews
);

export default router;
