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
exports.wishlistRepository = exports.WishlistRepository = void 0;
const mongoose_1 = require("mongoose");
const wishlist_model_1 = require("../models/wishlist.model");
class WishlistRepository {
    findByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield wishlist_model_1.WishlistItem.find({ userId }).populate("productId").sort({ createdAt: -1 });
        });
    }
    findOne(userId, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield wishlist_model_1.WishlistItem.findOne({ userId, productId });
        });
    }
    add(userId, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield wishlist_model_1.WishlistItem.findOneAndUpdate({ userId, productId }, {
                $setOnInsert: {
                    userId: new mongoose_1.Types.ObjectId(userId),
                    productId: new mongoose_1.Types.ObjectId(productId),
                },
            }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
        });
    }
    remove(userId, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield wishlist_model_1.WishlistItem.findOneAndDelete({ userId, productId });
        });
    }
}
exports.WishlistRepository = WishlistRepository;
exports.wishlistRepository = new WishlistRepository();
