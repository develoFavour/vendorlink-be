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
exports.wishlistController = exports.WishlistController = void 0;
const wishlist_service_1 = require("../services/wishlist.service");
const ApiResponse_1 = require("../utils/ApiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
class WishlistController {
    constructor() {
        this.getWishlist = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const wishlist = yield wishlist_service_1.wishlistService.getWishlist(req.user);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, wishlist, "Wishlist fetched successfully"));
        }));
        this.addToWishlist = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const wishlist = yield wishlist_service_1.wishlistService.addToWishlist(req.user, this.getParamId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, wishlist, "Product added to wishlist"));
        }));
        this.removeFromWishlist = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const wishlist = yield wishlist_service_1.wishlistService.removeFromWishlist(req.user, this.getParamId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, wishlist, "Product removed from wishlist"));
        }));
    }
    getParamId(req) {
        const id = req.params.productId;
        return Array.isArray(id) ? id[0] : id;
    }
}
exports.WishlistController = WishlistController;
exports.wishlistController = new WishlistController();
