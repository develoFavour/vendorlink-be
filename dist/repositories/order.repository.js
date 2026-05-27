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
exports.orderRepository = exports.OrderRepository = void 0;
const order_model_1 = require("../models/order.model");
class OrderRepository {
    create(orderData) {
        return __awaiter(this, void 0, void 0, function* () {
            const order = new order_model_1.Order(orderData);
            return yield order.save();
        });
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield order_model_1.Order.find().sort({ createdAt: -1 });
        });
    }
    findByBuyerId(buyerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield order_model_1.Order.find({ buyerId }).sort({ createdAt: -1 });
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield order_model_1.Order.findById(id);
        });
    }
    findByPaymentReference(reference) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield order_model_1.Order.findOne({ paymentReference: reference });
        });
    }
}
exports.OrderRepository = OrderRepository;
exports.orderRepository = new OrderRepository();
