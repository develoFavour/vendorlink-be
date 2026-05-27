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
exports.orderController = exports.OrderController = void 0;
const order_service_1 = require("../services/order.service");
const ApiResponse_1 = require("../utils/ApiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
class OrderController {
    constructor() {
        this.getOrders = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const orders = yield order_service_1.orderService.listOrders(req.user);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, orders, "Orders fetched successfully"));
        }));
        this.getAdminOrders = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield order_service_1.orderService.listAdminOrders(req.user, req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Admin orders fetched successfully"));
        }));
        this.getOrder = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const order = yield order_service_1.orderService.getOrder(req.user, this.getParamId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, order, "Order fetched successfully"));
        }));
        this.checkout = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield order_service_1.orderService.checkout(req.user, req.body);
            return res.status(201).json(new ApiResponse_1.ApiResponse(201, result, "Order placed successfully"));
        }));
        this.verifyPaystackPayment = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const reference = req.params.reference;
            const normalizedReference = Array.isArray(reference) ? reference[0] : reference;
            const order = yield order_service_1.orderService.verifyPaystackPayment(req.user, normalizedReference);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, order, "Payment verified successfully"));
        }));
        this.cancelBuyerOrder = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const order = yield order_service_1.orderService.cancelBuyerOrder(req.user, this.getParamId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, order, "Order cancelled successfully"));
        }));
        this.requestBuyerRefund = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const refundRequest = yield order_service_1.orderService.requestBuyerRefund(req.user, this.getParamId(req), req.body);
            return res.status(201).json(new ApiResponse_1.ApiResponse(201, refundRequest, "Refund request submitted successfully"));
        }));
        this.getSellerOrders = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield order_service_1.orderService.listSellerOrders(req.user, req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Seller orders fetched successfully"));
        }));
        this.getSellerOrder = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const order = yield order_service_1.orderService.getSellerOrder(req.user, this.getParamId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, order, "Seller order fetched successfully"));
        }));
        this.updateSellerOrderStatus = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const order = yield order_service_1.orderService.updateSellerOrderStatus(req.user, this.getParamId(req), req.body);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, order, "Seller order status updated"));
        }));
    }
    getParamId(req) {
        const id = req.params.id;
        return Array.isArray(id) ? id[0] : id;
    }
}
exports.OrderController = OrderController;
exports.orderController = new OrderController();
