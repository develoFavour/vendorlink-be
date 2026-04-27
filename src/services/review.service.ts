import { Types } from "mongoose";
import { IOrderFulfillment, IOrderItem, Order, OrderStatus } from "../models/order.model";
import { Product, ProductStatus } from "../models/product.model";
import { IReview, Review, ReviewModerationStatus } from "../models/review.model";
import { User, UserRole } from "../models/user.model";
import { ApiError } from "../utils/ApiError";

type CurrentUser = {
  id: string;
  role: UserRole;
};

type ReviewPayload = {
  rating?: number;
  title?: string;
  comment?: string;
};

type ReviewQuery = {
  page?: string | number;
  limit?: string | number;
  rating?: string | number;
  status?: ReviewModerationStatus | "All";
  search?: string;
  sort?: string;
};

type AdminModerationPayload = {
  reason?: string;
};

const trimValue = (value?: string) => (typeof value === "string" ? value.trim() : "");

const toPositiveInteger = (value: unknown, fallback: number, max = 100) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
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
    { moderationStatus: ReviewModerationStatus.VISIBLE },
    { moderationStatus: { $exists: false } },
  ],
};

class ReviewService {
  private ensureBuyer(user: CurrentUser) {
    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only buyers can review products");
    }
  }

  private ensureSeller(user: CurrentUser) {
    if (user.role !== UserRole.VENDOR && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only sellers can view seller ratings");
    }
  }

  private ensureAdmin(user: CurrentUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only admins can moderate ratings");
    }
  }

  private ensureValidObjectId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new ApiError(400, `Invalid ${label}`);
    }
  }

  private parsePayload(payload: ReviewPayload) {
    const rating = Number(payload.rating);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new ApiError(400, "Please select a rating from 1 to 5");
    }

    return {
      rating,
      title: trimValue(payload.title),
      comment: trimValue(payload.comment),
    };
  }

  private async getProductOrThrow(productId: string) {
    this.ensureValidObjectId(productId, "product id");
    const product = await Product.findById(productId);

    if (!product || product.status !== ProductStatus.PUBLISHED) {
      throw new ApiError(404, "Product not found");
    }

    return product;
  }

  private async getDeliveredPurchase(user: CurrentUser, productId: string) {
    const order = await Order.findOne({
      buyerId: user.id,
      "items.productId": productId,
    }).sort({ createdAt: -1 });

    if (!order) return null;

    const fulfillment = order.fulfillments?.find((item: IOrderFulfillment) =>
      item.items.some((orderItem: IOrderItem) => orderItem.productId.toString() === productId)
    );

    const delivered = fulfillment
      ? fulfillment.status === OrderStatus.DELIVERED
      : order.status === OrderStatus.DELIVERED;

    return delivered ? order : null;
  }

  private async buildSummary(productIds: Types.ObjectId[]) {
    if (!productIds.length) {
      return {
        averageRating: 0,
        totalReviews: 0,
        distribution: emptyDistribution(),
      };
    }

    const stats = await Review.aggregate<{
      _id: number;
      count: number;
    }>([
      { $match: { productId: { $in: productIds }, ...visibleReviewFilter } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
    ]);

    const distribution = emptyDistribution();
    let totalReviews = 0;
    let ratingTotal = 0;

    stats.forEach((item) => {
      const key = String(item._id) as keyof ReturnType<typeof emptyDistribution>;
      distribution[key] = item.count;
      totalReviews += item.count;
      ratingTotal += item._id * item.count;
    });

    return {
      averageRating: totalReviews ? Number((ratingTotal / totalReviews).toFixed(1)) : 0,
      totalReviews,
      distribution,
    };
  }

  private serializeReview(review: IReview) {
    const plain = review.toObject ? review.toObject() : review;
    const buyer = plain.buyerId as { _id?: Types.ObjectId; fullName?: string; email?: string } | Types.ObjectId;
    const product = plain.productId as
      | { _id?: Types.ObjectId; name?: string; image?: string; price?: number; category?: string }
      | Types.ObjectId;

    return {
      _id: plain._id,
      productId: product,
      buyerId: buyer,
      buyerName:
        buyer && typeof buyer === "object" && "fullName" in buyer
          ? buyer.fullName || "Verified buyer"
          : "Verified buyer",
      product:
        product && typeof product === "object" && "name" in product
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
      moderationStatus: plain.moderationStatus || ReviewModerationStatus.VISIBLE,
      hiddenReason: plain.hiddenReason || "",
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  }

  async listProductReviews(productId: string, query: ReviewQuery = {}) {
    await this.getProductOrThrow(productId);

    const page = toPositiveInteger(query.page, 1);
    const limit = toPositiveInteger(query.limit, 8, 50);
    const filter: Record<string, unknown> = { productId, ...visibleReviewFilter };

    if (query.rating) {
      const rating = Number(query.rating);
      if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
        filter.rating = rating;
      }
    }

    const productObjectId = new Types.ObjectId(productId);
    const [reviews, total, summary] = await Promise.all([
      Review.find(filter)
        .populate("buyerId", "fullName")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Review.countDocuments(filter),
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
  }

  async getEligibility(user: CurrentUser, productId: string) {
    this.ensureBuyer(user);
    const product = await this.getProductOrThrow(productId);

    if (product.vendorId.toString() === user.id) {
      return {
        canReview: false,
        reason: "You cannot review your own product",
        existingReview: null,
      };
    }

    const existingReview = await Review.findOne({ productId, buyerId: user.id });
    const purchaseOrder = await this.getDeliveredPurchase(user, productId);

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
  }

  async createReview(user: CurrentUser, productId: string, payload: ReviewPayload) {
    const eligibility = await this.getEligibility(user, productId);

    if (!eligibility.canReview || !eligibility.orderId) {
      throw new ApiError(403, eligibility.reason || "You are not allowed to review this product");
    }

    if (eligibility.existingReview) {
      throw new ApiError(409, "You have already reviewed this product");
    }

    const parsed = this.parsePayload(payload);
    const review = await Review.create({
      productId,
      buyerId: user.id,
      orderId: eligibility.orderId,
      rating: parsed.rating,
      title: parsed.title,
      comment: parsed.comment,
      isVerifiedPurchase: true,
    });

    return this.serializeReview(review);
  }

  async updateMyReview(user: CurrentUser, productId: string, payload: ReviewPayload) {
    await this.getProductOrThrow(productId);
    this.ensureBuyer(user);

    const review = await Review.findOne({ productId, buyerId: user.id });

    if (!review) {
      throw new ApiError(404, "Review not found");
    }

    const parsed = this.parsePayload(payload);
    review.rating = parsed.rating;
    review.title = parsed.title;
    review.comment = parsed.comment;
    await review.save();

    return this.serializeReview(review);
  }

  async deleteMyReview(user: CurrentUser, productId: string) {
    await this.getProductOrThrow(productId);
    this.ensureBuyer(user);

    const review = await Review.findOneAndDelete({ productId, buyerId: user.id });

    if (!review) {
      throw new ApiError(404, "Review not found");
    }

    return null;
  }

  async listSellerReviews(user: CurrentUser, query: ReviewQuery = {}) {
    this.ensureSeller(user);

    const page = toPositiveInteger(query.page, 1);
    const limit = toPositiveInteger(query.limit, 12, 50);
    const productFilter = user.role === UserRole.ADMIN ? {} : { vendorId: user.id };
    const products = await Product.find(productFilter).select("_id name image price category");
    const productIds = products.map((product) => product._id);
    const filter: Record<string, unknown> = { productId: { $in: productIds }, ...visibleReviewFilter };

    if (query.rating) {
      const rating = Number(query.rating);
      if (Number.isInteger(rating) && rating >= 1 && rating <= 5) {
        filter.rating = rating;
      }
    }

    const [reviews, total, summary] = await Promise.all([
      Review.find(filter)
        .populate("buyerId", "fullName")
        .populate("productId", "name image price category")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Review.countDocuments(filter),
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
  }

  async listAdminReviews(user: CurrentUser, query: ReviewQuery = {}) {
    this.ensureAdmin(user);

    const page = toPositiveInteger(query.page, 1);
    const limit = toPositiveInteger(query.limit, 20, 50);
    const filter: Record<string, unknown> = {};

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
      const [products, buyers] = await Promise.all([
        Product.find({
          $or: [{ name: regex }, { brand: regex }, { category: regex }, { sku: regex }],
        }).select("_id"),
        User.find({
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

    let sort: Record<string, 1 | -1> = { createdAt: -1 };

    if (query.sort === "oldest") {
      sort = { createdAt: 1 };
    } else if (query.sort === "rating_high") {
      sort = { rating: -1 };
    } else if (query.sort === "rating_low") {
      sort = { rating: 1 };
    }
    const [reviews, total, summary] = await Promise.all([
      Review.find(filter)
        .populate("buyerId", "fullName email")
        .populate("productId", "name image price category")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Review.countDocuments(filter),
      this.buildSummary((await Product.find().select("_id")).map((product) => product._id)),
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
  }

  async updateReviewModerationStatus(
    user: CurrentUser,
    reviewId: string,
    status: ReviewModerationStatus,
    payload: AdminModerationPayload = {}
  ) {
    this.ensureAdmin(user);
    this.ensureValidObjectId(reviewId, "review id");

    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(404, "Review not found");
    }

    review.moderationStatus = status;
    review.hiddenReason =
      status === ReviewModerationStatus.HIDDEN ? trimValue(payload.reason) || "Hidden by admin" : undefined;
    review.moderatedBy = new Types.ObjectId(user.id);
    review.moderatedAt = new Date();
    await review.save();

    await review.populate("buyerId", "fullName email");
    await review.populate("productId", "name image price category");

    return this.serializeReview(review);
  }

  async deleteReviewAsAdmin(user: CurrentUser, reviewId: string) {
    this.ensureAdmin(user);
    this.ensureValidObjectId(reviewId, "review id");

    const review = await Review.findByIdAndDelete(reviewId);

    if (!review) {
      throw new ApiError(404, "Review not found");
    }

    return null;
  }
}

export const reviewService = new ReviewService();
