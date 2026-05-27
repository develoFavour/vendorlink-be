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
exports.cartService = void 0;
const mongoose_1 = require("mongoose");
const product_model_1 = require("../models/product.model");
const user_model_1 = require("../models/user.model");
const cart_repository_1 = require("../repositories/cart.repository");
const product_repository_1 = require("../repositories/product.repository");
const ApiError_1 = require("../utils/ApiError");
const toPositiveQuantity = (value, fallback = 1) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1)
        return fallback;
    return parsed;
};
class CartService {
    ensureBuyer(user) {
        if (user.role !== user_model_1.UserRole.BUYER && user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only buyers can manage carts");
        }
    }
    ensurePurchasableProduct(productId) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = yield product_repository_1.productRepository.findById(productId);
            if (!product || product.status !== product_model_1.ProductStatus.PUBLISHED) {
                throw new ApiError_1.ApiError(404, "Product not found");
            }
            if (product.stock < 1) {
                throw new ApiError_1.ApiError(400, "Product is out of stock");
            }
            return product;
        });
    }
    serializeCart(cart) {
        if (!cart) {
            return { items: [], count: 0, subtotal: 0 };
        }
        const items = cart.items
            .filter((item) => item.productId)
            .map((item) => ({
            product: item.productId,
            quantity: item.quantity,
            lineTotal: item.productId.price * item.quantity,
        }));
        return {
            items,
            count: items.reduce((total, item) => total + item.quantity, 0),
            subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
        };
    }
    getCart(user) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            const cart = yield cart_repository_1.cartRepository.findByUserId(user.id);
            return this.serializeCart(cart);
        });
    }
    addToCart(user, productId, quantityValue) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            const product = yield this.ensurePurchasableProduct(productId);
            const quantity = toPositiveQuantity(quantityValue);
            const cart = yield cart_repository_1.cartRepository.getOrCreate(user.id);
            const existingItem = cart.items.find((item) => item.productId.toString() === productId);
            if (existingItem) {
                existingItem.quantity = Math.min(existingItem.quantity + quantity, product.stock);
            }
            else {
                cart.items.push({
                    productId: new mongoose_1.Types.ObjectId(productId),
                    quantity: Math.min(quantity, product.stock),
                });
            }
            return this.serializeCart(yield cart_repository_1.cartRepository.save(cart));
        });
    }
    updateCartItem(user, productId, quantityValue) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            const product = yield this.ensurePurchasableProduct(productId);
            const quantity = toPositiveQuantity(quantityValue);
            const cart = yield cart_repository_1.cartRepository.getOrCreate(user.id);
            const existingItem = cart.items.find((item) => item.productId.toString() === productId);
            if (!existingItem) {
                throw new ApiError_1.ApiError(404, "Cart item not found");
            }
            existingItem.quantity = Math.min(quantity, product.stock);
            return this.serializeCart(yield cart_repository_1.cartRepository.save(cart));
        });
    }
    removeFromCart(user, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            const cart = yield cart_repository_1.cartRepository.getOrCreate(user.id);
            cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
            return this.serializeCart(yield cart_repository_1.cartRepository.save(cart));
        });
    }
    clearCart(user) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            return this.serializeCart(yield cart_repository_1.cartRepository.clear(user.id));
        });
    }
}
exports.cartService = new CartService();
