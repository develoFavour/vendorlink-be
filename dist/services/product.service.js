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
exports.productService = void 0;
const mongoose_1 = require("mongoose");
const user_model_1 = require("../models/user.model");
const product_model_1 = require("../models/product.model");
const review_model_1 = require("../models/review.model");
const product_repository_1 = require("../repositories/product.repository");
const store_repository_1 = require("../repositories/store.repository");
const ApiError_1 = require("../utils/ApiError");
const toArray = (value) => {
    if (Array.isArray(value)) {
        return value.map(String).map((item) => item.trim()).filter(Boolean);
    }
    if (typeof value === "string") {
        return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [];
};
const toOptionalNumber = (value) => {
    if (value === undefined || value === null || value === "")
        return undefined;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
};
const toPositiveInteger = (value, fallback) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1)
        return fallback;
    return parsed;
};
const toOptionalString = (value) => {
    if (Array.isArray(value))
        return toOptionalString(value[0]);
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === "all")
        return undefined;
    return trimmed;
};
const toObject = (value) => {
    if (!value)
        return {};
    if (typeof value === "object" && !Array.isArray(value))
        return value;
    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
        }
        catch (_a) {
            return {};
        }
    }
    return {};
};
const toStylingIdeas = (value) => {
    const rawItems = (() => {
        if (Array.isArray(value))
            return value;
        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            }
            catch (_a) {
                return [];
            }
        }
        return [];
    })();
    return rawItems
        .map((item) => {
        const idea = item;
        return {
            name: String(idea.name || "").trim(),
            price: Number(idea.price || 0),
            image: idea.image ? String(idea.image) : undefined,
        };
    })
        .filter((item) => item.name && !Number.isNaN(item.price));
};
const normalizeProductPayload = (payload, partial = false) => {
    var _a, _b;
    const productData = {};
    const setValue = (key, value) => {
        if (partial && (value === undefined || value === null || value === ""))
            return;
        productData[key] = value;
    };
    setValue("name", payload.name);
    setValue("brand", payload.brand);
    setValue("shortDescription", payload.shortDescription);
    setValue("description", payload.description);
    setValue("price", payload.price === undefined ? undefined : Number(payload.price));
    setValue("compareAtPrice", toOptionalNumber(payload.compareAtPrice));
    setValue("discountPercent", toOptionalNumber(payload.discountPercent));
    setValue("stock", payload.stock === undefined ? undefined : Number((_a = payload.stock) !== null && _a !== void 0 ? _a : 0));
    setValue("soldCount", payload.soldCount === undefined ? undefined : Number((_b = payload.soldCount) !== null && _b !== void 0 ? _b : 0));
    setValue("category", payload.category);
    setValue("status", payload.status || (partial ? undefined : product_model_1.ProductStatus.DRAFT));
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
    withReviewSummaries(products) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!products.length)
                return products;
            const productIds = products.map((product) => product._id);
            const stats = yield review_model_1.Review.aggregate([
                {
                    $match: {
                        productId: { $in: productIds },
                        $or: [
                            { moderationStatus: review_model_1.ReviewModerationStatus.VISIBLE },
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
            const summaryMap = new Map(stats.map((item) => [
                item._id.toString(),
                {
                    totalReviews: item.totalReviews,
                    averageRating: item.totalReviews
                        ? Number((item.ratingTotal / item.totalReviews).toFixed(1))
                        : 0,
                },
            ]));
            return products.map((product) => {
                const plainProduct = "toObject" in product && typeof product.toObject === "function"
                    ? product.toObject()
                    : product;
                const summary = summaryMap.get(product._id.toString()) || {
                    totalReviews: 0,
                    averageRating: 0,
                };
                return Object.assign(Object.assign({}, plainProduct), { averageRating: summary.averageRating, totalReviews: summary.totalReviews });
            });
        });
    }
    createProduct(user, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user.role !== user_model_1.UserRole.VENDOR && user.role !== user_model_1.UserRole.ADMIN) {
                throw new ApiError_1.ApiError(403, "Only vendors can create products");
            }
            const store = yield store_repository_1.storeRepository.findByVendorId(user.id);
            const productData = normalizeProductPayload(payload);
            if (!productData.image) {
                throw new ApiError_1.ApiError(400, "Product image is required");
            }
            return yield product_repository_1.productRepository.create(Object.assign(Object.assign({}, productData), { vendorId: new mongoose_1.Types.ObjectId(user.id), storeId: store === null || store === void 0 ? void 0 : store._id }));
        });
    }
    getVendorProducts(user_1) {
        return __awaiter(this, arguments, void 0, function* (user, params = {}) {
            const page = toPositiveInteger(params.page, 1);
            const limit = Math.min(toPositiveInteger(params.limit, 10), 50);
            const minPrice = toOptionalNumber(params.minPrice);
            const maxPrice = toOptionalNumber(params.maxPrice);
            const { products, total } = yield product_repository_1.productRepository.findMany({
                vendorId: user.role === user_model_1.UserRole.ADMIN ? undefined : user.id,
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
                products: yield this.withReviewSummaries(products),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
            };
        });
    }
    getPublicProducts() {
        return __awaiter(this, arguments, void 0, function* (params = {}) {
            const page = toPositiveInteger(params.page, 1);
            const limit = Math.min(toPositiveInteger(params.limit, 12), 50);
            const minPrice = toOptionalNumber(params.minPrice);
            const maxPrice = toOptionalNumber(params.maxPrice);
            const { products, total } = yield product_repository_1.productRepository.findMany({
                search: toOptionalString(params.search),
                category: toOptionalString(params.category),
                status: product_model_1.ProductStatus.PUBLISHED,
                sort: toOptionalString(params.sort),
                minPrice,
                maxPrice,
                page,
                limit,
            });
            const totalPages = Math.max(Math.ceil(total / limit), 1);
            return {
                products: yield this.withReviewSummaries(products),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
            };
        });
    }
    getProductById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield product_repository_1.productRepository.findById(id);
            if (!product) {
                throw new ApiError_1.ApiError(404, "Product not found");
            }
            return (yield this.withReviewSummaries([product]))[0];
        });
    }
    getPublicProductById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield this.getProductById(id);
            if (product.status !== product_model_1.ProductStatus.PUBLISHED) {
                throw new ApiError_1.ApiError(404, "Product not found");
            }
            return product;
        });
    }
    updateProduct(user, id, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield this.getProductById(id);
            if (user.role !== user_model_1.UserRole.ADMIN && product.vendorId.toString() !== user.id) {
                throw new ApiError_1.ApiError(403, "You can only update your own products");
            }
            const productData = normalizeProductPayload(payload, true);
            const updatedProduct = yield product_repository_1.productRepository.updateById(id, productData);
            if (!updatedProduct) {
                throw new ApiError_1.ApiError(404, "Product not found");
            }
            return (yield this.withReviewSummaries([updatedProduct]))[0];
        });
    }
    deleteProduct(user, id) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield this.getProductById(id);
            if (user.role !== user_model_1.UserRole.ADMIN && product.vendorId.toString() !== user.id) {
                throw new ApiError_1.ApiError(403, "You can only delete your own products");
            }
            return yield product_repository_1.productRepository.deleteById(id);
        });
    }
}
exports.productService = new ProductService();
