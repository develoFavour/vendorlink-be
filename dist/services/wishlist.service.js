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
exports.wishlistService = void 0;
const product_model_1 = require("../models/product.model");
const user_model_1 = require("../models/user.model");
const product_repository_1 = require("../repositories/product.repository");
const wishlist_repository_1 = require("../repositories/wishlist.repository");
const ApiError_1 = require("../utils/ApiError");
class WishlistService {
    ensureBuyer(user) {
        if (user.role !== user_model_1.UserRole.BUYER && user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only buyers can manage wishlists");
        }
    }
    ensurePublishedProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield product_repository_1.productRepository.findById(productId);
            if (!product || product.status !== product_model_1.ProductStatus.PUBLISHED) {
                throw new ApiError_1.ApiError(404, "Product not found");
            }
            return product;
        });
    }
    getWishlist(user) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            const items = yield wishlist_repository_1.wishlistRepository.findByUserId(user.id);
            return {
                items,
                productIds: items.map((item) => item.productId._id.toString()),
                count: items.length,
            };
        });
    }
    addToWishlist(user, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            yield this.ensurePublishedProduct(productId);
            yield wishlist_repository_1.wishlistRepository.add(user.id, productId);
            return yield this.getWishlist(user);
        });
    }
    removeFromWishlist(user, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            yield wishlist_repository_1.wishlistRepository.remove(user.id, productId);
            return yield this.getWishlist(user);
        });
    }
}
exports.wishlistService = new WishlistService();
