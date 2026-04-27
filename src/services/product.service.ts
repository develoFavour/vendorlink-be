import { Types } from "mongoose";
import { UserRole } from "../models/user.model";
import { ProductStatus } from "../models/product.model";
import { Review, ReviewModerationStatus } from "../models/review.model";
import { productRepository } from "../repositories/product.repository";
import { storeRepository } from "../repositories/store.repository";
import { ApiError } from "../utils/ApiError";

type CurrentUser = {
  id: string;
  role: UserRole;
};

type ProductListParams = Record<string, unknown>;

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const toPositiveInteger = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return toOptionalString(value[0]);
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") return undefined;
  return trimmed;
};

const toObject = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
};

const toStylingIdeas = (value: unknown): { name: string; price: number; image?: string }[] => {
  const rawItems = (() => {
    if (Array.isArray(value)) return value;

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  })();

  return rawItems
    .map((item) => {
      const idea = item as Record<string, unknown>;
      return {
        name: String(idea.name || "").trim(),
        price: Number(idea.price || 0),
        image: idea.image ? String(idea.image) : undefined,
      };
    })
    .filter((item) => item.name && !Number.isNaN(item.price));
};

const normalizeProductPayload = (payload: any, partial = false) => {
  const productData: Record<string, unknown> = {};
  const setValue = (key: string, value: unknown) => {
    if (partial && (value === undefined || value === null || value === "")) return;
    productData[key] = value;
  };

  setValue("name", payload.name);
  setValue("brand", payload.brand);
  setValue("shortDescription", payload.shortDescription);
  setValue("description", payload.description);
  setValue("price", payload.price === undefined ? undefined : Number(payload.price));
  setValue("compareAtPrice", toOptionalNumber(payload.compareAtPrice));
  setValue("discountPercent", toOptionalNumber(payload.discountPercent));
  setValue("stock", payload.stock === undefined ? undefined : Number(payload.stock ?? 0));
  setValue("soldCount", payload.soldCount === undefined ? undefined : Number(payload.soldCount ?? 0));
  setValue("category", payload.category);
  setValue("status", payload.status || (partial ? undefined : ProductStatus.DRAFT));
  setValue("image", payload.image);
  setValue("gallery", payload.gallery === undefined ? undefined : toArray(payload.gallery));
  setValue("color", payload.color);
  setValue("sku", payload.sku);
  setValue("weight", payload.weight);
  setValue("deliveryNote", payload.deliveryNote);
  setValue("sizes", payload.sizes === undefined ? undefined : toArray(payload.sizes));
  setValue("tags", payload.tags === undefined ? undefined : toArray(payload.tags));
  setValue("specifications", payload.specifications === undefined ? undefined : toObject(payload.specifications));
  setValue("stylingIdeas", payload.stylingIdeas === undefined ? undefined : toStylingIdeas(payload.stylingIdeas));

  return productData;
};

class ProductService {
  private async withReviewSummaries<T extends { _id: Types.ObjectId }>(products: T[]) {
    if (!products.length) return products;

    const productIds = products.map((product) => product._id);
    const stats = await Review.aggregate<{
      _id: Types.ObjectId;
      totalReviews: number;
      ratingTotal: number;
    }>([
      {
        $match: {
          productId: { $in: productIds },
          $or: [
            { moderationStatus: ReviewModerationStatus.VISIBLE },
            { moderationStatus: { $exists: false } },
          ],
        },
      },
      {
        $group: {
          _id: "$productId",
          totalReviews: { $sum: 1 },
          ratingTotal: { $sum: "$rating" },
        },
      },
    ]);

    const summaryMap = new Map(
      stats.map((item) => [
        item._id.toString(),
        {
          totalReviews: item.totalReviews,
          averageRating: item.totalReviews
            ? Number((item.ratingTotal / item.totalReviews).toFixed(1))
            : 0,
        },
      ])
    );

    return products.map((product) => {
      const plainProduct =
        "toObject" in product && typeof product.toObject === "function"
          ? product.toObject()
          : product;
      const summary = summaryMap.get(product._id.toString()) || {
        totalReviews: 0,
        averageRating: 0,
      };

      return {
        ...plainProduct,
        averageRating: summary.averageRating,
        totalReviews: summary.totalReviews,
      };
    });
  }

  async createProduct(user: CurrentUser, payload: any) {
    if (user.role !== UserRole.VENDOR && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only vendors can create products");
    }

    const store = await storeRepository.findByVendorId(user.id);
    const productData = normalizeProductPayload(payload);

    if (!productData.image) {
      throw new ApiError(400, "Product image is required");
    }

    return await productRepository.create({
      ...productData,
      vendorId: new Types.ObjectId(user.id),
      storeId: store?._id,
    });
  }

  async getVendorProducts(user: CurrentUser, params: ProductListParams = {}) {
    const page = toPositiveInteger(params.page, 1);
    const limit = Math.min(toPositiveInteger(params.limit, 10), 50);
    const minPrice = toOptionalNumber(params.minPrice);
    const maxPrice = toOptionalNumber(params.maxPrice);

    const { products, total } = await productRepository.findMany({
      vendorId: user.role === UserRole.ADMIN ? undefined : user.id,
      search: toOptionalString(params.search),
      category: toOptionalString(params.category),
      status: toOptionalString(params.status),
      sort: toOptionalString(params.sort),
      minPrice,
      maxPrice,
      page,
      limit,
    });

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return {
      products: await this.withReviewSummaries(products),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getPublicProducts(params: ProductListParams = {}) {
    const page = toPositiveInteger(params.page, 1);
    const limit = Math.min(toPositiveInteger(params.limit, 12), 50);
    const minPrice = toOptionalNumber(params.minPrice);
    const maxPrice = toOptionalNumber(params.maxPrice);

    const { products, total } = await productRepository.findMany({
      search: toOptionalString(params.search),
      category: toOptionalString(params.category),
      status: ProductStatus.PUBLISHED,
      sort: toOptionalString(params.sort),
      minPrice,
      maxPrice,
      page,
      limit,
    });

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return {
      products: await this.withReviewSummaries(products),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async getProductById(id: string) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new ApiError(404, "Product not found");
    }

    return (await this.withReviewSummaries([product]))[0];
  }

  async getPublicProductById(id: string) {
    const product = await this.getProductById(id);
    if (product.status !== ProductStatus.PUBLISHED) {
      throw new ApiError(404, "Product not found");
    }

    return product;
  }

  async updateProduct(user: CurrentUser, id: string, payload: any) {
    const product = await this.getProductById(id);

    if (user.role !== UserRole.ADMIN && product.vendorId.toString() !== user.id) {
      throw new ApiError(403, "You can only update your own products");
    }

    const productData = normalizeProductPayload(payload, true);
    const updatedProduct = await productRepository.updateById(id, productData);

    if (!updatedProduct) {
      throw new ApiError(404, "Product not found");
    }

    return (await this.withReviewSummaries([updatedProduct]))[0];
  }

  async deleteProduct(user: CurrentUser, id: string) {
    const product = await this.getProductById(id);

    if (user.role !== UserRole.ADMIN && product.vendorId.toString() !== user.id) {
      throw new ApiError(403, "You can only delete your own products");
    }

    return await productRepository.deleteById(id);
  }
}

export const productService = new ProductService();
