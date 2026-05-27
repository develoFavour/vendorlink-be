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
exports.dashboardService = void 0;
const order_model_1 = require("../models/order.model");
const product_model_1 = require("../models/product.model");
const refundRequest_model_1 = require("../models/refundRequest.model");
const store_model_1 = require("../models/store.model");
const user_model_1 = require("../models/user.model");
const ApiError_1 = require("../utils/ApiError");
const activeStatuses = [
    order_model_1.OrderStatus.PENDING,
    order_model_1.OrderStatus.PROCESSING,
    order_model_1.OrderStatus.READY,
    order_model_1.OrderStatus.IN_TRANSIT,
];
const queueStatuses = [
    order_model_1.OrderStatus.PENDING,
    order_model_1.OrderStatus.PROCESSING,
    order_model_1.OrderStatus.READY,
    order_model_1.OrderStatus.IN_TRANSIT,
];
const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const getLastSevenDays = () => {
    const today = new Date();
    return Array.from({ length: 7 }).map((_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - index));
        date.setHours(0, 0, 0, 0);
        return {
            date,
            label: dayLabels[date.getDay()],
            revenue: 0,
            orders: 0,
        };
    });
};
class DashboardService {
    ensureAdmin(user) {
        if (user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only admins can access platform analytics");
        }
    }
    ensureSeller(user) {
        if (user.role !== user_model_1.UserRole.VENDOR && user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only sellers can access seller dashboard analytics");
        }
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
            vendorId: sellerId,
            items: legacyItems,
            subtotal: legacyItems.reduce((total, item) => total + item.lineTotal, 0),
            status: order.status,
            statusHistory: [],
            updatedAt: order.updatedAt,
        };
    }
    getSellerOverview(user) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureSeller(user);
            const sellerId = user.id;
            const orderFilter = {
                $or: [
                    { "fulfillments.vendorId": sellerId },
                    { "items.vendorId": sellerId },
                ],
            };
            const [totalProducts, publishedProducts, draftProducts, lowStockProducts, sellerOrders,] = yield Promise.all([
                product_model_1.Product.countDocuments({ vendorId: sellerId }),
                product_model_1.Product.countDocuments({ vendorId: sellerId, status: product_model_1.ProductStatus.PUBLISHED }),
                product_model_1.Product.countDocuments({ vendorId: sellerId, status: product_model_1.ProductStatus.DRAFT }),
                product_model_1.Product.find({ vendorId: sellerId, stock: { $lte: 5 } })
                    .sort({ stock: 1, updatedAt: -1 })
                    .limit(5)
                    .select("name image stock price sku status category"),
                order_model_1.Order.find(orderFilter).sort({ createdAt: -1 }).limit(250),
            ]);
            const sellerFulfillments = sellerOrders
                .map((order) => ({ order, fulfillment: this.getSellerFulfillment(order, sellerId) }))
                .filter((entry) => Boolean(entry.fulfillment));
            const revenueEligible = sellerFulfillments.filter(({ order, fulfillment }) => fulfillment.status !== order_model_1.OrderStatus.CANCELLED &&
                order.paymentStatus !== order_model_1.PaymentStatus.FAILED);
            const grossRevenue = revenueEligible.reduce((total, { fulfillment }) => total + fulfillment.subtotal, 0);
            const activeOrders = sellerFulfillments.filter(({ fulfillment }) => activeStatuses.includes(fulfillment.status)).length;
            const weeklySales = getLastSevenDays();
            revenueEligible.forEach(({ order, fulfillment }) => {
                const createdAt = new Date(order.createdAt);
                createdAt.setHours(0, 0, 0, 0);
                const target = weeklySales.find((day) => day.date.getTime() === createdAt.getTime());
                if (target) {
                    target.revenue += fulfillment.subtotal;
                    target.orders += 1;
                }
            });
            const fulfillmentQueue = queueStatuses.map((status) => ({
                status,
                count: sellerFulfillments.filter(({ fulfillment }) => fulfillment.status === status).length,
            }));
            const recentOrders = sellerFulfillments.slice(0, 5).map(({ order, fulfillment }) => ({
                _id: order._id,
                orderNumber: order.orderNumber,
                buyerName: order.deliveryAddress.fullName,
                buyerCity: order.deliveryAddress.city,
                status: fulfillment.status,
                paymentStatus: order.paymentStatus,
                subtotal: fulfillment.subtotal,
                itemCount: fulfillment.items.reduce((total, item) => total + item.quantity, 0),
                firstItem: fulfillment.items[0],
                createdAt: order.createdAt,
            }));
            return {
                metrics: {
                    grossRevenue,
                    activeOrders,
                    totalProducts,
                    publishedProducts,
                    draftProducts,
                    customerRating: null,
                },
                weeklySales: weeklySales.map(({ label, revenue, orders }) => ({ label, revenue, orders })),
                fulfillmentQueue,
                recentOrders,
                lowStockProducts,
            };
        });
    }
    getAdminOverview(user) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureAdmin(user);
            const [totalUsers, buyers, vendors, admins, activeStores, suspendedStores, pendingStores, totalProducts, publishedProducts, draftProducts, totalOrders, activeOrders, deliveredOrders, paidOrders, pendingRefunds, recentOrders,] = yield Promise.all([
                user_model_1.User.countDocuments(),
                user_model_1.User.countDocuments({ role: user_model_1.UserRole.BUYER }),
                user_model_1.User.countDocuments({ role: user_model_1.UserRole.VENDOR }),
                user_model_1.User.countDocuments({ role: user_model_1.UserRole.ADMIN }),
                store_model_1.Store.countDocuments({ status: store_model_1.StoreStatus.ACTIVE }),
                store_model_1.Store.countDocuments({ status: store_model_1.StoreStatus.SUSPENDED }),
                store_model_1.Store.countDocuments({ status: store_model_1.StoreStatus.PENDING }),
                product_model_1.Product.countDocuments(),
                product_model_1.Product.countDocuments({ status: product_model_1.ProductStatus.PUBLISHED }),
                product_model_1.Product.countDocuments({ status: product_model_1.ProductStatus.DRAFT }),
                order_model_1.Order.countDocuments(),
                order_model_1.Order.countDocuments({ status: { $in: activeStatuses } }),
                order_model_1.Order.countDocuments({ status: order_model_1.OrderStatus.DELIVERED }),
                order_model_1.Order.find({ paymentStatus: order_model_1.PaymentStatus.PAID }).select("total createdAt status paymentStatus"),
                refundRequest_model_1.RefundRequest.countDocuments({ status: refundRequest_model_1.RefundRequestStatus.PENDING }),
                order_model_1.Order.find().sort({ createdAt: -1 }).limit(6),
            ]);
            const grossRevenue = paidOrders.reduce((total, order) => total + order.total, 0);
            const platformCommission = Math.round(grossRevenue * 0.1);
            const weeklySales = getLastSevenDays();
            paidOrders.forEach((order) => {
                const createdAt = new Date(order.createdAt);
                createdAt.setHours(0, 0, 0, 0);
                const target = weeklySales.find((day) => day.date.getTime() === createdAt.getTime());
                if (target) {
                    target.revenue += order.total;
                    target.orders += 1;
                }
            });
            return {
                metrics: {
                    totalUsers,
                    buyers,
                    vendors,
                    admins,
                    activeStores,
                    suspendedStores,
                    pendingStores,
                    totalProducts,
                    publishedProducts,
                    draftProducts,
                    totalOrders,
                    activeOrders,
                    deliveredOrders,
                    grossRevenue,
                    platformCommission,
                    pendingRefunds,
                },
                weeklySales: weeklySales.map(({ label, revenue, orders }) => ({ label, revenue, orders })),
                moderationQueue: [
                    {
                        label: "Pending refunds",
                        count: pendingRefunds,
                        priority: pendingRefunds > 0 ? "High" : "Clear",
                    },
                    {
                        label: "Suspended vendors",
                        count: suspendedStores,
                        priority: suspendedStores > 0 ? "Review" : "Clear",
                    },
                    {
                        label: "Draft listings",
                        count: draftProducts,
                        priority: draftProducts > 0 ? "Monitor" : "Clear",
                    },
                    {
                        label: "Legacy pending stores",
                        count: pendingStores,
                        priority: pendingStores > 0 ? "Cleanup" : "Clear",
                    },
                ],
                recentOrders: recentOrders.map((order) => ({
                    _id: order._id,
                    orderNumber: order.orderNumber,
                    buyerName: order.deliveryAddress.fullName,
                    status: order.status,
                    paymentStatus: order.paymentStatus,
                    total: order.total,
                    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
                    createdAt: order.createdAt,
                })),
            };
        });
    }
}
exports.dashboardService = new DashboardService();
