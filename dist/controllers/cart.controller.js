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
exports.cartController = exports.CartController = void 0;
const cart_service_1 = require("../services/cart.service");
const ApiResponse_1 = require("../utils/ApiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
class CartController {
    constructor() {
        this.getCart = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const cart = yield cart_service_1.cartService.getCart(req.user);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, cart, "Cart fetched successfully"));
        }));
        this.addToCart = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const cart = yield cart_service_1.cartService.addToCart(req.user, this.getParamId(req), req.body.quantity);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, cart, "Product added to cart"));
        }));
        this.updateCartItem = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const cart = yield cart_service_1.cartService.updateCartItem(req.user, this.getParamId(req), req.body.quantity);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, cart, "Cart item updated"));
        }));
        this.removeFromCart = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const cart = yield cart_service_1.cartService.removeFromCart(req.user, this.getParamId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, cart, "Product removed from cart"));
        }));
        this.clearCart = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const cart = yield cart_service_1.cartService.clearCart(req.user);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, cart, "Cart cleared"));
        }));
    }
    getParamId(req) {
        const id = req.params.productId;
        return Array.isArray(id) ? id[0] : id;
    }
}
exports.CartController = CartController;
exports.cartController = new CartController();
