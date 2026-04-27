import { Order, OrderStatus, PaymentStatus, IOrder, IOrderFulfillment, IOrderItem } from "../models/order.model";
import { Product, ProductStatus } from "../models/product.model";
import { RefundRequest, RefundRequestStatus } from "../models/refundRequest.model";
import { Store, StoreStatus } from "../models/store.model";
import { User, UserRole } from "../models/user.model";
import { ApiError } from "../utils/ApiError";

type CurrentUser = {
  id: string;
  role: UserRole;
};

const activeStatuses = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.READY,
  OrderStatus.IN_TRANSIT,
];

const queueStatuses = [
  OrderStatus.PENDING,
  OrderStatus.PROCESSING,
  OrderStatus.READY,
  OrderStatus.IN_TRANSIT,
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
  private ensureAdmin(user: CurrentUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only admins can access platform analytics");
    }
  }

  private ensureSeller(user: CurrentUser) {
    if (user.role !== UserRole.VENDOR && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only sellers can access seller dashboard analytics");
    }
  }

  private getSellerFulfillment(order: IOrder, sellerId: string) {
    const fulfillment = order.fulfillments?.find(
      (item: IOrderFulfillment) => item.vendorId.toString() === sellerId
    );

    if (fulfillment) return fulfillment;

    const legacyItems = order.items.filter((item: IOrderItem) => item.vendorId.toString() === sellerId);
    if (!legacyItems.length) return null;

    return {
      vendorId: sellerId,
      items: legacyItems,
      subtotal: legacyItems.reduce((total, item) => total + item.lineTotal, 0),
      status: order.status,
      statusHistory: [],
      updatedAt: order.updatedAt,
    };
  }

  async getSellerOverview(user: CurrentUser) {
    this.ensureSeller(user);
    const sellerId = user.id;

    const orderFilter = {
      $or: [
        { "fulfillments.vendorId": sellerId },
        { "items.vendorId": sellerId },
      ],
    };

    const [
      totalProducts,
      publishedProducts,
      draftProducts,
      lowStockProducts,
      sellerOrders,
    ] = await Promise.all([
      Product.countDocuments({ vendorId: sellerId }),
      Product.countDocuments({ vendorId: sellerId, status: ProductStatus.PUBLISHED }),
      Product.countDocuments({ vendorId: sellerId, status: ProductStatus.DRAFT }),
      Product.find({ vendorId: sellerId, stock: { $lte: 5 } })
        .sort({ stock: 1, updatedAt: -1 })
        .limit(5)
        .select("name image stock price sku status category"),
      Order.find(orderFilter).sort({ createdAt: -1 }).limit(250),
    ]);

    const sellerFulfillments = sellerOrders
      .map((order) => ({ order, fulfillment: this.getSellerFulfillment(order, sellerId) }))
      .filter((entry): entry is { order: IOrder; fulfillment: NonNullable<ReturnType<DashboardService["getSellerFulfillment"]>> } =>
        Boolean(entry.fulfillment)
      );

    const revenueEligible = sellerFulfillments.filter(
      ({ order, fulfillment }) =>
        fulfillment.status !== OrderStatus.CANCELLED &&
        order.paymentStatus !== PaymentStatus.FAILED
    );
    const grossRevenue = revenueEligible.reduce(
      (total, { fulfillment }) => total + fulfillment.subtotal,
      0
    );
    const activeOrders = sellerFulfillments.filter(({ fulfillment }) =>
      activeStatuses.includes(fulfillment.status)
    ).length;

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
  }

  async getAdminOverview(user: CurrentUser) {
    this.ensureAdmin(user);

    const [
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
      paidOrders,
      pendingRefunds,
      recentOrders,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: UserRole.BUYER }),
      User.countDocuments({ role: UserRole.VENDOR }),
      User.countDocuments({ role: UserRole.ADMIN }),
      Store.countDocuments({ status: StoreStatus.ACTIVE }),
      Store.countDocuments({ status: StoreStatus.SUSPENDED }),
      Store.countDocuments({ status: StoreStatus.PENDING }),
      Product.countDocuments(),
      Product.countDocuments({ status: ProductStatus.PUBLISHED }),
      Product.countDocuments({ status: ProductStatus.DRAFT }),
      Order.countDocuments(),
      Order.countDocuments({ status: { $in: activeStatuses } }),
      Order.countDocuments({ status: OrderStatus.DELIVERED }),
      Order.find({ paymentStatus: PaymentStatus.PAID }).select("total createdAt status paymentStatus"),
      RefundRequest.countDocuments({ status: RefundRequestStatus.PENDING }),
      Order.find().sort({ createdAt: -1 }).limit(6),
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
        itemCount: order.items.reduce((total: number, item: IOrderItem) => total + item.quantity, 0),
        createdAt: order.createdAt,
      })),
    };
  }
}

export const dashboardService = new DashboardService();
