"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.orderService = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const cart_model_1 = require("../models/cart.model");
const order_model_1 = require("../models/order.model");
const product_model_1 = require("../models/product.model");
const refundRequest_model_1 = require("../models/refundRequest.model");
const user_model_1 = require("../models/user.model");
const order_repository_1 = require("../repositories/order.repository");
const user_repository_1 = require("../repositories/user.repository");
const earning_service_1 = require("./earning.service");
const ApiError_1 = require("../utils/ApiError");
const email_1 = require("../utils/email");
const paystack_1 = require("../utils/paystack");
const DELIVERY_FEE = 2500;
const FREE_DELIVERY_THRESHOLD = 100000;
const trimValue = (value) => (typeof value === "string" ? value.trim() : "");
const generateOrderNumber = () => `VL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const generatePaymentReference = () => `VL-PAY-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toPositiveInteger = (value, fallback, max = 100) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1)
        return fallback;
    return Math.min(parsed, max);
};
const refundDeductionByStatus = {
    [order_model_1.OrderStatus.PENDING]: 0,
    [order_model_1.OrderStatus.PROCESSING]: 0,
    [order_model_1.OrderStatus.READY]: 10,
    [order_model_1.OrderStatus.IN_TRANSIT]: 10,
    [order_model_1.OrderStatus.DELIVERED]: 10,
    [order_model_1.OrderStatus.CANCELLED]: 0,
};
const sellerAllowedTransitions = {
    [order_model_1.OrderStatus.PENDING]: [order_model_1.OrderStatus.PROCESSING, order_model_1.OrderStatus.CANCELLED],
    [order_model_1.OrderStatus.PROCESSING]: [order_model_1.OrderStatus.READY, order_model_1.OrderStatus.CANCELLED],
    [order_model_1.OrderStatus.READY]: [order_model_1.OrderStatus.IN_TRANSIT, order_model_1.OrderStatus.CANCELLED],
    [order_model_1.OrderStatus.IN_TRANSIT]: [order_model_1.OrderStatus.DELIVERED],
    [order_model_1.OrderStatus.DELIVERED]: [],
    [order_model_1.OrderStatus.CANCELLED]: [],
};
class OrderService {
    ensureAdmin(user) {
        if (user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only admins can manage all orders");
        }
    }
    ensureBuyer(user) {
        if (user.role !== user_model_1.UserRole.BUYER && user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only buyers can place orders");
        }
    }
    ensureSeller(user) {
        if (user.role !== user_model_1.UserRole.VENDOR && user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only sellers can manage seller orders");
        }
    }
    parseDeliveryAddress(address) {
        const deliveryAddress = {
            fullName: trimValue(address === null || address === void 0 ? void 0 : address.fullName),
            phone: trimValue(address === null || address === void 0 ? void 0 : address.phone),
            address: trimValue(address === null || address === void 0 ? void 0 : address.address),
            city: trimValue(address === null || address === void 0 ? void 0 : address.city),
            state: trimValue(address === null || address === void 0 ? void 0 : address.state),
            note: trimValue(address === null || address === void 0 ? void 0 : address.note),
        };
        const missingField = Object.entries(deliveryAddress).find(([key, value]) => key !== "note" && !value);
        if (missingField) {
            throw new ApiError_1.ApiError(400, "Delivery address is incomplete");
        }
        return deliveryAddress;
    }
    parsePaymentMethod(value) {
        const allowedMethods = [order_model_1.PaymentMethod.CASH_ON_DELIVERY, order_model_1.PaymentMethod.PAYSTACK];
        if (!value || !allowedMethods.includes(value)) {
            throw new ApiError_1.ApiError(400, "Please select a valid payment method");
        }
        return value;
    }
    getDeliveryFee(subtotal) {
        return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    }
    getPaystackCallbackUrl() {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        return `${frontendUrl.replace(/\/$/, "")}/buyer/checkout/verify`;
    }
    buildFulfillments(items, userId) {
        const grouped = new Map();
        items.forEach((item) => {
            const vendorId = item.vendorId.toString();
            grouped.set(vendorId, [...(grouped.get(vendorId) || []), item]);
        });
        return Array.from(grouped.entries()).map(([vendorId, vendorItems]) => ({
            vendorId: new mongoose_1.Types.ObjectId(vendorId),
            items: vendorItems,
            subtotal: vendorItems.reduce((total, item) => total + item.lineTotal, 0),
            status: order_model_1.OrderStatus.PENDING,
            statusHistory: [
                {
                    status: order_model_1.OrderStatus.PENDING,
                    note: "Order created",
                    updatedBy: new mongoose_1.Types.ObjectId(userId),
                    updatedAt: new Date(),
                },
            ],
            updatedAt: new Date(),
        }));
    }
    getSellerFulfillment(order, sellerId) {
        var _a;
        const fulfillment = (_a = order.fulfillments) === null || _a === void 0 ? void 0 : _a.find((item) => item.vendorId.toString() === sellerId);
        if (fulfillment)
            return fulfillment;
        const legacyItems = order.items.filter((item) => item.vendorId.toString() === sellerId);
        if (!legacyItems.length)
            return null;
        return {
            vendorId: new mongoose_1.Types.ObjectId(sellerId),
            items: legacyItems,
            subtotal: legacyItems.reduce((total, item) => total + item.lineTotal, 0),
            status: order.status,
            statusHistory: [],
            updatedAt: order.updatedAt,
        };
    }
    serializeSellerOrder(order, sellerId) {
        const fulfillment = this.getSellerFulfillment(order, sellerId);
        if (!fulfillment)
            return null;
        return {
            _id: order._id,
            orderNumber: order.orderNumber,
            buyerId: order.buyerId,
            deliveryAddress: order.deliveryAddress,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            paidAt: order.paidAt,
            status: fulfillment.status,
            trackingNote: fulfillment.trackingNote || "",
            items: fulfillment.items,
            subtotal: fulfillment.subtotal,
            itemCount: fulfillment.items.reduce((total, item) => total + item.quantity, 0),
            statusHistory: fulfillment.statusHistory || [],
            createdAt: order.createdAt,
            updatedAt: fulfillment.updatedAt || order.updatedAt,
        };
    }
    serializeBuyerOrder(order) {
        return {
            _id: order._id,
            orderNumber: order.orderNumber,
            buyerId: order.buyerId,
            items: order.items,
            fulfillments: order.fulfillments || [],
            deliveryAddress: order.deliveryAddress,
            subtotal: order.subtotal,
            deliveryFee: order.deliveryFee,
            total: order.total,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            paymentReference: order.paymentReference,
            paymentAccessCode: order.paymentAccessCode,
            paidAt: order.paidAt,
            status: order.status,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
        };
    }
    getAggregateOrderStatus(fulfillments) {
        if (!fulfillments.length)
            return order_model_1.OrderStatus.PENDING;
        const statuses = fulfillments.map((fulfillment) => fulfillment.status);
        if (statuses.every((status) => status === order_model_1.OrderStatus.DELIVERED))
            return order_model_1.OrderStatus.DELIVERED;
        if (statuses.every((status) => status === order_model_1.OrderStatus.CANCELLED))
            return order_model_1.OrderStatus.CANCELLED;
        if (statuses.some((status) => status === order_model_1.OrderStatus.IN_TRANSIT))
            return order_model_1.OrderStatus.IN_TRANSIT;
        if (statuses.some((status) => status === order_model_1.OrderStatus.READY))
            return order_model_1.OrderStatus.READY;
        if (statuses.some((status) => status === order_model_1.OrderStatus.PROCESSING))
            return order_model_1.OrderStatus.PROCESSING;
        return order_model_1.OrderStatus.PENDING;
    }
    getBuyerOrderUrl(orderId) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        return `${frontendUrl.replace(/\/$/, "")}/buyer/orders/${orderId}`;
    }
    sendOrderStatusEmailSafely({ order, status, note, items, }) {
        user_repository_1.userRepository
            .findById(order.buyerId.toString())
            .then((buyer) => {
            if (!buyer)
                return;
            return (0, email_1.sendOrderStatusEmail)({
                email: buyer.email,
                fullName: buyer.fullName,
                orderNumber: order.orderNumber,
                status,
                note,
                itemNames: ((items === null || items === void 0 ? void 0 : items.length) ? items : order.items).map((item) => item.name),
                orderUrl: this.getBuyerOrderUrl(order._id.toString()),
            });
        })
            .catch((error) => {
            console.error("Order status email failed:", error.message);
        });
    }
    listOrders(user) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            if (user.role === user_model_1.UserRole.ADMIN) {
                const orders = yield order_repository_1.orderRepository.findAll();
                return orders.map((order) => this.serializeBuyerOrder(order));
            }
            const orders = yield order_repository_1.orderRepository.findByBuyerId(user.id);
            return orders.map((order) => this.serializeBuyerOrder(order));
        });
    }
    listAdminOrders(user_1) {
        return __awaiter(this, arguments, void 0, function* (user, query = {}) {
            this.ensureAdmin(user);
            const page = toPositiveInteger(query.page, 1);
            const limit = toPositiveInteger(query.limit, 20, 50);
            const filter = {};
            if (query.search) {
                const regex = new RegExp(escapeRegex(query.search), "i");
                filter.$or = [
                    { orderNumber: regex },
                    { "deliveryAddress.fullName": regex },
                    { "deliveryAddress.city": regex },
                    { "deliveryAddress.state": regex },
                    { "items.name": regex },
                ];
            }
            if (query.status && query.status !== "All") {
                filter.status = query.status;
            }
            if (query.paymentStatus && query.paymentStatus !== "All") {
                filter.paymentStatus = query.paymentStatus;
            }
            if (query.paymentMethod && query.paymentMethod !== "All") {
                filter.paymentMethod = query.paymentMethod;
            }
            if (query.from || query.to) {
                filter.createdAt = Object.assign(Object.assign({}, (query.from ? { $gte: new Date(query.from) } : {})), (query.to ? { $lte: new Date(query.to) } : {}));
            }
            let sort = { createdAt: -1 };
            if (query.sort === "oldest") {
                sort = { createdAt: 1 };
            }
            else if (query.sort === "total_desc") {
                sort = { total: -1 };
            }
            else if (query.sort === "total_asc") {
                sort = { total: 1 };
            }
            const skip = (page - 1) * limit;
            const [orders, total] = yield Promise.all([
                order_model_1.Order.find(filter).sort(sort).skip(skip).limit(limit),
                order_model_1.Order.countDocuments(filter),
            ]);
            return {
                orders: orders.map((order) => this.serializeBuyerOrder(order)),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.max(Math.ceil(total / limit), 1),
                    hasNextPage: page * limit < total,
                    hasPrevPage: page > 1,
                },
            };
        });
    }
    getOrder(user, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            const order = yield order_repository_1.orderRepository.findById(orderId);
            if (!order) {
                throw new ApiError_1.ApiError(404, "Order not found");
            }
            if (user.role !== user_model_1.UserRole.ADMIN && order.buyerId.toString() !== user.id) {
                throw new ApiError_1.ApiError(403, "You are not allowed to view this order");
            }
            return this.serializeBuyerOrder(order);
        });
    }
    checkout(user, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            const deliveryAddress = this.parseDeliveryAddress(payload.deliveryAddress);
            const paymentMethod = this.parsePaymentMethod(payload.paymentMethod);
            const buyer = yield user_repository_1.userRepository.findById(user.id);
            if (!buyer) {
                throw new ApiError_1.ApiError(401, "User session is no longer valid");
            }
            if (paymentMethod === order_model_1.PaymentMethod.PAYSTACK && !process.env.PAYSTACK_SECRET_KEY) {
                throw new ApiError_1.ApiError(500, "Paystack secret key is not configured");
            }
            const paymentReference = paymentMethod === order_model_1.PaymentMethod.PAYSTACK ? generatePaymentReference() : undefined;
            const session = yield mongoose_1.default.startSession();
            try {
                let createdOrder = null;
                yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    const cart = yield cart_model_1.Cart.findOne({ userId: user.id })
                        .populate("items.productId")
                        .session(session);
                    if (!cart || cart.items.length === 0) {
                        throw new ApiError_1.ApiError(400, "Your cart is empty");
                    }
                    const cartItems = cart.items;
                    const items = cartItems.map((item) => {
                        const product = item.productId;
                        if (!product || product.status !== product_model_1.ProductStatus.PUBLISHED) {
                            throw new ApiError_1.ApiError(400, "One or more products in your cart are no longer available");
                        }
                        if (product.stock < item.quantity) {
                            throw new ApiError_1.ApiError(400, `${product.name} has only ${product.stock} item(s) left`);
                        }
                        return {
                            productId: product._id,
                            vendorId: product.vendorId,
                            name: product.name,
                            image: product.image,
                            price: product.price,
                            quantity: item.quantity,
                            lineTotal: product.price * item.quantity,
                        };
                    });
                    const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
                    const deliveryFee = this.getDeliveryFee(subtotal);
                    const total = subtotal + deliveryFee;
                    const fulfillments = this.buildFulfillments(items, user.id);
                    for (const item of items) {
                        const updatedProduct = yield product_model_1.Product.findOneAndUpdate({
                            _id: item.productId,
                            status: product_model_1.ProductStatus.PUBLISHED,
                            stock: { $gte: item.quantity },
                        }, {
                            $inc: {
                                stock: -item.quantity,
                                soldCount: item.quantity,
                            },
                        }, { returnDocument: "after", session });
                        if (!updatedProduct) {
                            throw new ApiError_1.ApiError(400, "A product in your cart has insufficient stock");
                        }
                    }
                    const [order] = yield order_model_1.Order.create([
                        {
                            orderNumber: generateOrderNumber(),
                            buyerId: new mongoose_1.Types.ObjectId(user.id),
                            items,
                            fulfillments,
                            deliveryAddress,
                            subtotal,
                            deliveryFee,
                            total,
                            paymentMethod,
                            paymentReference,
                            paymentStatus: order_model_1.PaymentStatus.PENDING,
                            status: order_model_1.OrderStatus.PENDING,
                        },
                    ], { session });
                    yield cart_model_1.Cart.findOneAndUpdate({ userId: user.id }, { $set: { items: [] } }, { session });
                    createdOrder = order;
                }));
                if (!createdOrder) {
                    throw new ApiError_1.ApiError(500, "Unable to create order");
                }
                const order = createdOrder;
                if (paymentMethod !== order_model_1.PaymentMethod.PAYSTACK) {
                    yield earning_service_1.earningService.syncOrderEarnings(order);
                    return { order };
                }
                const payment = yield paystack_1.paystack.initializeTransaction({
                    email: buyer.email,
                    amount: Math.round(order.total * 100),
                    reference: paymentReference,
                    callbackUrl: this.getPaystackCallbackUrl(),
                    metadata: {
                        orderId: order._id.toString(),
                        orderNumber: order.orderNumber,
                        buyerId: user.id,
                    },
                });
                order.paymentAccessCode = payment.access_code;
                yield order.save();
                yield earning_service_1.earningService.syncOrderEarnings(order);
                return {
                    order,
                    payment: {
                        provider: "paystack",
                        authorizationUrl: payment.authorization_url,
                        accessCode: payment.access_code,
                        reference: payment.reference,
                    },
                };
            }
            finally {
                yield session.endSession();
            }
        });
    }
    verifyPaystackPayment(user, reference) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            const order = yield order_repository_1.orderRepository.findByPaymentReference(reference);
            if (!order) {
                throw new ApiError_1.ApiError(404, "Order not found for this payment reference");
            }
            if (user.role !== user_model_1.UserRole.ADMIN && order.buyerId.toString() !== user.id) {
                throw new ApiError_1.ApiError(403, "You are not allowed to verify this order");
            }
            if (order.paymentStatus === order_model_1.PaymentStatus.PAID) {
                return this.serializeBuyerOrder(order);
            }
            const transaction = yield paystack_1.paystack.verifyTransaction(reference);
            const expectedAmount = Math.round(order.total * 100);
            if (transaction.status !== "success") {
                order.paymentStatus = order_model_1.PaymentStatus.FAILED;
                yield order.save();
                throw new ApiError_1.ApiError(400, "Payment was not successful");
            }
            if (transaction.amount !== expectedAmount || transaction.currency !== "NGN") {
                order.paymentStatus = order_model_1.PaymentStatus.FAILED;
                yield order.save();
                throw new ApiError_1.ApiError(400, "Payment verification failed amount validation");
            }
            order.paymentStatus = order_model_1.PaymentStatus.PAID;
            order.status = order_model_1.OrderStatus.PROCESSING;
            order.paidAt = transaction.paid_at ? new Date(transaction.paid_at) : new Date();
            yield order.save();
            yield earning_service_1.earningService.syncOrderEarnings(order);
            return this.serializeBuyerOrder(order);
        });
    }
    cancelBuyerOrder(user, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureBuyer(user);
            const session = yield mongoose_1.default.startSession();
            try {
                let cancelledOrder = null;
                yield session.withTransaction(() => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const order = yield order_model_1.Order.findById(orderId).session(session);
                    if (!order) {
                        throw new ApiError_1.ApiError(404, "Order not found");
                    }
                    if (user.role !== user_model_1.UserRole.ADMIN && order.buyerId.toString() !== user.id) {
                        throw new ApiError_1.ApiError(403, "You are not allowed to cancel this order");
                    }
                    const fulfillments = ((_a = order.fulfillments) === null || _a === void 0 ? void 0 : _a.length)
                        ? order.fulfillments
                        : this.buildFulfillments(order.items, user.id);
                    const canCancelImmediately = fulfillments.every((fulfillment) => fulfillment.status === order_model_1.OrderStatus.PENDING);
                    if (!canCancelImmediately) {
                        throw new ApiError_1.ApiError(400, "This order is already being fulfilled. Please request a refund instead");
                    }
                    for (const item of order.items) {
                        yield product_model_1.Product.findByIdAndUpdate(item.productId, {
                            $inc: {
                                stock: item.quantity,
                                soldCount: -item.quantity,
                            },
                        }, { session });
                    }
                    order.fulfillments = fulfillments.map((fulfillment) => (Object.assign(Object.assign({}, fulfillment), { status: order_model_1.OrderStatus.CANCELLED, updatedAt: new Date(), statusHistory: [
                            ...(fulfillment.statusHistory || []),
                            {
                                status: order_model_1.OrderStatus.CANCELLED,
                                note: "Cancelled by buyer before fulfillment started",
                                updatedBy: new mongoose_1.Types.ObjectId(user.id),
                                updatedAt: new Date(),
                            },
                        ] })));
                    order.status = order_model_1.OrderStatus.CANCELLED;
                    if (order.paymentStatus === order_model_1.PaymentStatus.PAID) {
                        yield refundRequest_model_1.RefundRequest.findOneAndUpdate({
                            orderId: order._id,
                            buyerId: order.buyerId,
                            status: refundRequest_model_1.RefundRequestStatus.PENDING,
                        }, {
                            $setOnInsert: {
                                orderId: order._id,
                                buyerId: order.buyerId,
                                reason: "Order cancelled before fulfillment started",
                                status: refundRequest_model_1.RefundRequestStatus.PENDING,
                                requestedAmount: order.total,
                                deductionPercent: 0,
                                deductionAmount: 0,
                                finalRefundAmount: order.total,
                                paymentMethod: order.paymentMethod,
                            },
                        }, { upsert: true, returnDocument: "after", session });
                    }
                    yield order.save({ session });
                    cancelledOrder = order;
                }));
                if (!cancelledOrder) {
                    throw new ApiError_1.ApiError(500, "Unable to cancel order");
                }
                this.sendOrderStatusEmailSafely({
                    order: cancelledOrder,
                    status: order_model_1.OrderStatus.CANCELLED,
                    note: "Order cancelled before fulfillment started",
                });
                yield earning_service_1.earningService.syncOrderEarnings(cancelledOrder);
                return this.serializeBuyerOrder(cancelledOrder);
            }
            finally {
                yield session.endSession();
            }
        });
    }
    requestBuyerRefund(user, orderId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.ensureBuyer(user);
            const reason = trimValue(payload.reason);
            if (!reason) {
                throw new ApiError_1.ApiError(400, "Please provide a reason for this refund request");
            }
            const order = yield order_model_1.Order.findById(orderId);
            if (!order) {
                throw new ApiError_1.ApiError(404, "Order not found");
            }
            if (user.role !== user_model_1.UserRole.ADMIN && order.buyerId.toString() !== user.id) {
                throw new ApiError_1.ApiError(403, "You are not allowed to request a refund for this order");
            }
            if (order.status === order_model_1.OrderStatus.CANCELLED) {
                throw new ApiError_1.ApiError(400, "This order has already been cancelled");
            }
            const existingPendingRequest = yield refundRequest_model_1.RefundRequest.findOne({
                orderId: order._id,
                buyerId: order.buyerId,
                status: refundRequest_model_1.RefundRequestStatus.PENDING,
            });
            if (existingPendingRequest) {
                return existingPendingRequest;
            }
            const statuses = ((_a = order.fulfillments) === null || _a === void 0 ? void 0 : _a.length)
                ? order.fulfillments.map((fulfillment) => fulfillment.status)
                : [order.status];
            const deductionPercent = Math.max(...statuses.map((status) => { var _a; return (_a = refundDeductionByStatus[status]) !== null && _a !== void 0 ? _a : 10; }));
            const deductionAmount = Math.round((order.total * deductionPercent) / 100);
            const finalRefundAmount = Math.max(order.total - deductionAmount, 0);
            return refundRequest_model_1.RefundRequest.create({
                orderId: order._id,
                buyerId: order.buyerId,
                reason,
                status: refundRequest_model_1.RefundRequestStatus.PENDING,
                requestedAmount: order.total,
                deductionPercent,
                deductionAmount,
                finalRefundAmount,
                paymentMethod: order.paymentMethod,
            });
        });
    }
    listSellerOrders(user_1) {
        return __awaiter(this, arguments, void 0, function* (user, query = {}) {
            this.ensureSeller(user);
            const sellerId = user.id;
            const page = toPositiveInteger(query.page, 1);
            const limit = toPositiveInteger(query.limit, 20, 50);
            const filter = {
                $or: [
                    { "fulfillments.vendorId": sellerId },
                    { "items.vendorId": sellerId },
                ],
            };
            if (query.search) {
                const regex = new RegExp(escapeRegex(query.search), "i");
                filter.$and = [
                    ...(Array.isArray(filter.$and) ? filter.$and : []),
                    {
                        $or: [
                            { orderNumber: regex },
                            { "deliveryAddress.fullName": regex },
                            { "deliveryAddress.city": regex },
                            { "items.name": regex },
                        ],
                    },
                ];
            }
            if (query.paymentStatus && query.paymentStatus !== "All") {
                filter.paymentStatus = query.paymentStatus;
            }
            if (query.status && query.status !== "All") {
                filter.$and = [
                    ...(Array.isArray(filter.$and) ? filter.$and : []),
                    {
                        $or: [
                            { fulfillments: { $elemMatch: { vendorId: sellerId, status: query.status } } },
                            { fulfillments: { $size: 0 }, status: query.status },
                        ],
                    },
                ];
            }
            if (query.from || query.to) {
                filter.createdAt = Object.assign(Object.assign({}, (query.from ? { $gte: new Date(query.from) } : {})), (query.to ? { $lte: new Date(query.to) } : {}));
            }
            const sort = query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
            const skip = (page - 1) * limit;
            const [orders, total] = yield Promise.all([
                order_model_1.Order.find(filter).sort(sort).skip(skip).limit(limit),
                order_model_1.Order.countDocuments(filter),
            ]);
            const sellerOrders = orders
                .map((order) => this.serializeSellerOrder(order, sellerId))
                .filter(Boolean);
            return {
                orders: sellerOrders,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.max(Math.ceil(total / limit), 1),
                    hasNextPage: page * limit < total,
                    hasPrevPage: page > 1,
                },
            };
        });
    }
    getSellerOrder(user, orderId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureSeller(user);
            const order = yield order_model_1.Order.findById(orderId);
            if (!order) {
                throw new ApiError_1.ApiError(404, "Order not found");
            }
            const sellerOrder = this.serializeSellerOrder(order, user.id);
            if (!sellerOrder) {
                throw new ApiError_1.ApiError(403, "You are not allowed to view this order");
            }
            return sellerOrder;
        });
    }
    updateSellerOrderStatus(user, orderId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            this.ensureSeller(user);
            const requestedStatus = payload.status;
            if (!requestedStatus || !Object.values(order_model_1.OrderStatus).includes(requestedStatus)) {
                throw new ApiError_1.ApiError(400, "Please select a valid order status");
            }
            const order = yield order_model_1.Order.findById(orderId);
            if (!order) {
                throw new ApiError_1.ApiError(404, "Order not found");
            }
            let fulfillment = (_a = order.fulfillments) === null || _a === void 0 ? void 0 : _a.find((item) => item.vendorId.toString() === user.id);
            if (!fulfillment) {
                const legacyFulfillment = this.getSellerFulfillment(order, user.id);
                if (!legacyFulfillment) {
                    throw new ApiError_1.ApiError(403, "You are not allowed to update this order");
                }
                order.fulfillments = [...(order.fulfillments || []), legacyFulfillment];
                fulfillment = order.fulfillments[order.fulfillments.length - 1];
            }
            if (!fulfillment) {
                throw new ApiError_1.ApiError(403, "You are not allowed to update this order");
            }
            if (order.paymentMethod === order_model_1.PaymentMethod.PAYSTACK &&
                order.paymentStatus !== order_model_1.PaymentStatus.PAID &&
                requestedStatus !== order_model_1.OrderStatus.CANCELLED) {
                throw new ApiError_1.ApiError(400, "Paystack orders must be paid before fulfillment can continue");
            }
            const allowedStatuses = sellerAllowedTransitions[fulfillment.status] || [];
            if (!allowedStatuses.includes(requestedStatus)) {
                throw new ApiError_1.ApiError(400, `Cannot move order from ${fulfillment.status} to ${requestedStatus}`);
            }
            fulfillment.status = requestedStatus;
            fulfillment.trackingNote = trimValue(payload.note) || fulfillment.trackingNote;
            fulfillment.updatedAt = new Date();
            fulfillment.statusHistory = [
                ...(fulfillment.statusHistory || []),
                {
                    status: requestedStatus,
                    note: trimValue(payload.note),
                    updatedBy: new mongoose_1.Types.ObjectId(user.id),
                    updatedAt: new Date(),
                },
            ];
            order.status = this.getAggregateOrderStatus(order.fulfillments || []);
            yield order.save();
            yield earning_service_1.earningService.syncOrderEarnings(order);
            this.sendOrderStatusEmailSafely({
                order,
                status: requestedStatus,
                note: trimValue(payload.note),
                items: fulfillment.items,
            });
            return this.serializeSellerOrder(order, user.id);
        });
    }
}
exports.orderService = new OrderService();
