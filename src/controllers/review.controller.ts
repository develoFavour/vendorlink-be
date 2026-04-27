import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { reviewService } from "../services/review.service";
import { ReviewModerationStatus } from "../models/review.model";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

class ReviewController {
  private getProductId(req: AuthenticatedRequest) {
    const productId = req.params.productId;
    return Array.isArray(productId) ? productId[0] : productId;
  }

  private getReviewId(req: AuthenticatedRequest) {
    const reviewId = req.params.reviewId;
    return Array.isArray(reviewId) ? reviewId[0] : reviewId;
  }

  public listProductReviews = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await reviewService.listProductReviews(this.getProductId(req), req.query);
    return res.status(200).json(new ApiResponse(200, result, "Reviews fetched successfully"));
  });

  public getEligibility = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await reviewService.getEligibility(req.user!, this.getProductId(req));
    return res.status(200).json(new ApiResponse(200, result, "Review eligibility fetched successfully"));
  });

  public createReview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const review = await reviewService.createReview(req.user!, this.getProductId(req), req.body);
    return res.status(201).json(new ApiResponse(201, review, "Review submitted successfully"));
  });

  public updateMyReview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const review = await reviewService.updateMyReview(req.user!, this.getProductId(req), req.body);
    return res.status(200).json(new ApiResponse(200, review, "Review updated successfully"));
  });

  public deleteMyReview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await reviewService.deleteMyReview(req.user!, this.getProductId(req));
    return res.status(200).json(new ApiResponse(200, null, "Review deleted successfully"));
  });

  public listSellerReviews = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await reviewService.listSellerReviews(req.user!, req.query);
    return res.status(200).json(new ApiResponse(200, result, "Seller reviews fetched successfully"));
  });

  public listAdminReviews = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await reviewService.listAdminReviews(req.user!, req.query);
    return res.status(200).json(new ApiResponse(200, result, "Admin reviews fetched successfully"));
  });

  public hideReview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const review = await reviewService.updateReviewModerationStatus(
      req.user!,
      this.getReviewId(req),
      ReviewModerationStatus.HIDDEN,
      req.body
    );
    return res.status(200).json(new ApiResponse(200, review, "Review hidden successfully"));
  });

  public restoreReview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const review = await reviewService.updateReviewModerationStatus(
      req.user!,
      this.getReviewId(req),
      ReviewModerationStatus.VISIBLE,
      req.body
    );
    return res.status(200).json(new ApiResponse(200, review, "Review restored successfully"));
  });

  public deleteReviewAsAdmin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await reviewService.deleteReviewAsAdmin(req.user!, this.getReviewId(req));
    return res.status(200).json(new ApiResponse(200, null, "Review deleted successfully"));
  });
}

export const reviewController = new ReviewController();
