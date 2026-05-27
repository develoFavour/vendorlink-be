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
exports.cartRepository = exports.CartRepository = void 0;
const mongoose_1 = require("mongoose");
const cart_model_1 = require("../models/cart.model");
class CartRepository {
    findByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield cart_model_1.Cart.findOne({ userId }).populate("items.productId");
        });
    }
    getOrCreate(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cart = yield cart_model_1.Cart.findOneAndUpdate({ userId }, { $setOnInsert: { userId: new mongoose_1.Types.ObjectId(userId), items: [] } }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true });
            return cart;
        });
    }
    save(cart) {
        return __awaiter(this, void 0, void 0, function* () {
            yield cart.save();
            return yield cart_model_1.Cart.findById(cart._id).populate("items.productId");
        });
    }
    clear(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield cart_model_1.Cart.findOneAndUpdate({ userId }, { $set: { items: [] } }, { returnDocument: "after" }).populate("items.productId");
        });
    }
}
exports.CartRepository = CartRepository;
exports.cartRepository = new CartRepository();
