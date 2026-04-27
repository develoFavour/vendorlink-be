import mongoose, { Types } from "mongoose";
import { Cart } from "../models/cart.model";
import { IOrder, IOrderFulfillment, IOrderItem, Order, OrderStatus, PaymentMethod, PaymentStatus } from "../models/order.model";
import { IProduct, Product, ProductStatus } from "../models/product.model";
import { RefundRequest, RefundRequestStatus } from "../models/refundRequest.model";
import { UserRole } from "../models/user.model";
import { orderRepository } from "../repositories/order.repository";
import { userRepository } from "../repositories/user.repository";
import { earningService } from "./earning.service";
import { ApiError } from "../utils/ApiError";
import { sendOrderStatusEmail } from "../utils/email";
import { paystack } from "../utils/paystack";

type CurrentUser = {
  id: string;
  role: UserRole;
};

type CheckoutAddress = {
  fullName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  note?: string;
};

type CheckoutPayload = {
  deliveryAddress?: CheckoutAddress;
  paymentMethod?: PaymentMethod;
};

type SellerOrderQuery = {
  search?: string;
  status?: OrderStatus | "All";
  paymentStatus?: PaymentStatus | "All";
  paymentMethod?: PaymentMethod | "All";
  from?: string;
  to?: string;
  sort?: string;
  page?: string | number;
  limit?: string | number;
};

type UpdateSellerStatusPayload = {
  status?: OrderStatus;
  note?: string;
};

type RefundRequestPayload = {
  reason?: string;
};

type CheckoutResult = {
  order: IOrder;
  payment?: {
    provider: "paystack";
    authorizationUrl: string;
    accessCode: string;
    reference: string;
  };
};

type PopulatedCartItem = {
  productId: IProduct;
  quantity: number;
};

const DELIVERY_FEE = 2500;
const FREE_DELIVERY_THRESHOLD = 100000;

const trimValue = (value?: string) => (typeof value === "string" ? value.trim() : "");

const generateOrderNumber = () =>
  `VL-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const generatePaymentReference = () =>
  `VL-PAY-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPositiveInteger = (value: unknown, fallback: number, max = 100) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const refundDeductionByStatus: Record<OrderStatus, number> = {
  [OrderStatus.PENDING]: 0,
  [OrderStatus.PROCESSING]: 0,
  [OrderStatus.READY]: 10,
  [OrderStatus.IN_TRANSIT]: 10,
  [OrderStatus.DELIVERED]: 10,
  [OrderStatus.CANCELLED]: 0,
};

const sellerAllowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

class OrderService {
  private ensureAdmin(user: CurrentUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only admins can manage all orders");
    }
  }

  private ensureBuyer(user: CurrentUser) {
    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only buyers can place orders");
    }
  }

  private ensureSeller(user: CurrentUser) {
    if (user.role !== UserRole.VENDOR && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only sellers can manage seller orders");
    }
  }

  private parseDeliveryAddress(address?: CheckoutAddress) {
    const deliveryAddress = {
      fullName: trimValue(address?.fullName),
      phone: trimValue(address?.phone),
      address: trimValue(address?.address),
      city: trimValue(address?.city),
      state: trimValue(address?.state),
      note: trimValue(address?.note),
    };

    const missingField = Object.entries(deliveryAddress).find(
      ([key, value]) => key !== "note" && !value
    );

    if (missingField) {
      throw new ApiError(400, "Delivery address is incomplete");
    }

    return deliveryAddress;
  }

  private parsePaymentMethod(value?: PaymentMethod) {
    const allowedMethods = [PaymentMethod.CASH_ON_DELIVERY, PaymentMethod.PAYSTACK];

    if (!value || !allowedMethods.includes(value)) {
      throw new ApiError(400, "Please select a valid payment method");
    }

    return value;
  }

  private getDeliveryFee(subtotal: number) {
    return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  }

  private getPaystackCallbackUrl() {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return `${frontendUrl.replace(/\/$/, "")}/buyer/checkout/verify`;
  }

  private buildFulfillments(items: IOrderItem[], userId: string): IOrderFulfillment[] {
    const grouped = new Map<string, IOrderItem[]>();

    items.forEach((item) => {
      const vendorId = item.vendorId.toString();
      grouped.set(vendorId, [...(grouped.get(vendorId) || []), item]);
    });

    return Array.from(grouped.entries()).map(([vendorId, vendorItems]) => ({
      vendorId: new Types.ObjectId(vendorId),
      items: vendorItems,
      subtotal: vendorItems.reduce((total, item) => total + item.lineTotal, 0),
      status: OrderStatus.PENDING,
      statusHistory: [
        {
          status: OrderStatus.PENDING,
          note: "Order created",
          updatedBy: new Types.ObjectId(userId),
          updatedAt: new Date(),
        },
      ],
      updatedAt: new Date(),
    }));
  }

  private getSellerFulfillment(order: IOrder, sellerId: string) {
    const fulfillment = order.fulfillments?.find(
      (item) => item.vendorId.toString() === sellerId
    );

    if (fulfillment) return fulfillment;

    const legacyItems = order.items.filter((item) => item.vendorId.toString() === sellerId);
    if (!legacyItems.length) return null;

    return {
      vendorId: new Types.ObjectId(sellerId),
      items: legacyItems,
      subtotal: legacyItems.reduce((total, item) => total + item.lineTotal, 0),
      status: order.status,
      statusHistory: [],
      updatedAt: order.updatedAt,
    } as IOrderFulfillment;
  }

  private serializeSellerOrder(order: IOrder, sellerId: string) {
    const fulfillment = this.getSellerFulfillment(order, sellerId);

    if (!fulfillment) return null;

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

  private serializeBuyerOrder(order: IOrder) {
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

  private getAggregateOrderStatus(fulfillments: IOrderFulfillment[]) {
    if (!fulfillments.length) return OrderStatus.PENDING;
    const statuses = fulfillments.map((fulfillment) => fulfillment.status);

    if (statuses.every((status) => status === OrderStatus.DELIVERED)) return OrderStatus.DELIVERED;
    if (statuses.every((status) => status === OrderStatus.CANCELLED)) return OrderStatus.CANCELLED;
    if (statuses.some((status) => status === OrderStatus.IN_TRANSIT)) return OrderStatus.IN_TRANSIT;
    if (statuses.some((status) => status === OrderStatus.READY)) return OrderStatus.READY;
    if (statuses.some((status) => status === OrderStatus.PROCESSING)) return OrderStatus.PROCESSING;
    return OrderStatus.PENDING;
  }

  private getBuyerOrderUrl(orderId: string) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return `${frontendUrl.replace(/\/$/, "")}/buyer/orders/${orderId}`;
  }

  private sendOrderStatusEmailSafely({
    order,
    status,
    note,
    items,
  }: {
    order: IOrder;
    status: OrderStatus;
    note?: string;
    items?: IOrderItem[];
  }) {
    userRepository
      .findById(order.buyerId.toString())
      .then((buyer) => {
        if (!buyer) return;

        return sendOrderStatusEmail({
          email: buyer.email,
          fullName: buyer.fullName,
          orderNumber: order.orderNumber,
          status,
          note,
          itemNames: (items?.length ? items : order.items).map((item) => item.name),
          orderUrl: this.getBuyerOrderUrl(order._id.toString()),
        });
      })
      .catch((error) => {
        console.error("Order status email failed:", error.message);
      });
  }

  async listOrders(user: CurrentUser) {
    this.ensureBuyer(user);

    if (user.role === UserRole.ADMIN) {
      const orders = await orderRepository.findAll();
      return orders.map((order) => this.serializeBuyerOrder(order));
    }

    const orders = await orderRepository.findByBuyerId(user.id);
    return orders.map((order) => this.serializeBuyerOrder(order));
  }

  async listAdminOrders(user: CurrentUser, query: SellerOrderQuery = {}) {
    this.ensureAdmin(user);

    const page = toPositiveInteger(query.page, 1);
    const limit = toPositiveInteger(query.limit, 20, 50);
    const filter: Record<string, unknown> = {};

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
      filter.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    let sort: Record<string, 1 | -1> = { createdAt: -1 };

    if (query.sort === "oldest") {
      sort = { createdAt: 1 };
    } else if (query.sort === "total_desc") {
      sort = { total: -1 };
    } else if (query.sort === "total_asc") {
      sort = { total: 1 };
    }
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limit),
      Order.countDocuments(filter),
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
  }

  async getOrder(user: CurrentUser, orderId: string) {
    this.ensureBuyer(user);
    const order = await orderRepository.findById(orderId);

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (user.role !== UserRole.ADMIN && order.buyerId.toString() !== user.id) {
      throw new ApiError(403, "You are not allowed to view this order");
    }

    return this.serializeBuyerOrder(order);
  }

  async checkout(user: CurrentUser, payload: CheckoutPayload): Promise<CheckoutResult> {
    this.ensureBuyer(user);

    const deliveryAddress = this.parseDeliveryAddress(payload.deliveryAddress);
    const paymentMethod = this.parsePaymentMethod(payload.paymentMethod);
    const buyer = await userRepository.findById(user.id);

    if (!buyer) {
      throw new ApiError(401, "User session is no longer valid");
    }

    if (paymentMethod === PaymentMethod.PAYSTACK && !process.env.PAYSTACK_SECRET_KEY) {
      throw new ApiError(500, "Paystack secret key is not configured");
    }

    const paymentReference =
      paymentMethod === PaymentMethod.PAYSTACK ? generatePaymentReference() : undefined;
    const session = await mongoose.startSession();

    try {
      let createdOrder: IOrder | null = null;

      await session.withTransaction(async () => {
        const cart = await Cart.findOne({ userId: user.id })
          .populate("items.productId")
          .session(session);

        if (!cart || cart.items.length === 0) {
          throw new ApiError(400, "Your cart is empty");
        }

        const cartItems = cart.items as unknown as PopulatedCartItem[];
        const items = cartItems.map((item) => {
          const product = item.productId;

          if (!product || product.status !== ProductStatus.PUBLISHED) {
            throw new ApiError(400, "One or more products in your cart are no longer available");
          }

          if (product.stock < item.quantity) {
            throw new ApiError(400, `${product.name} has only ${product.stock} item(s) left`);
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
          const updatedProduct = await Product.findOneAndUpdate(
            {
              _id: item.productId,
              status: ProductStatus.PUBLISHED,
              stock: { $gte: item.quantity },
            },
            {
              $inc: {
                stock: -item.quantity,
                soldCount: item.quantity,
              },
            },
            { returnDocument: "after", session }
          );

          if (!updatedProduct) {
            throw new ApiError(400, "A product in your cart has insufficient stock");
          }
        }

        const [order] = await Order.create(
          [
            {
              orderNumber: generateOrderNumber(),
              buyerId: new Types.ObjectId(user.id),
              items,
              fulfillments,
              deliveryAddress,
              subtotal,
              deliveryFee,
              total,
              paymentMethod,
              paymentReference,
              paymentStatus: PaymentStatus.PENDING,
              status: OrderStatus.PENDING,
            },
          ],
          { session }
        );

        await Cart.findOneAndUpdate(
          { userId: user.id },
          { $set: { items: [] } },
          { session }
        );

        createdOrder = order;
      });

      if (!createdOrder) {
        throw new ApiError(500, "Unable to create order");
      }

      const order = createdOrder as IOrder;

      if (paymentMethod !== PaymentMethod.PAYSTACK) {
        await earningService.syncOrderEarnings(order);
        return { order };
      }

      const payment = await paystack.initializeTransaction({
        email: buyer.email,
        amount: Math.round(order.total * 100),
        reference: paymentReference!,
        callbackUrl: this.getPaystackCallbackUrl(),
        metadata: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          buyerId: user.id,
        },
      });

      order.paymentAccessCode = payment.access_code;
      await order.save();
      await earningService.syncOrderEarnings(order);

      return {
        order,
        payment: {
          provider: "paystack",
          authorizationUrl: payment.authorization_url,
          accessCode: payment.access_code,
          reference: payment.reference,
        },
      };
    } finally {
      await session.endSession();
    }
  }

  async verifyPaystackPayment(user: CurrentUser, reference: string) {
    this.ensureBuyer(user);

    const order = await orderRepository.findByPaymentReference(reference);

    if (!order) {
      throw new ApiError(404, "Order not found for this payment reference");
    }

    if (user.role !== UserRole.ADMIN && order.buyerId.toString() !== user.id) {
      throw new ApiError(403, "You are not allowed to verify this order");
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      return this.serializeBuyerOrder(order);
    }

    const transaction = await paystack.verifyTransaction(reference);
    const expectedAmount = Math.round(order.total * 100);

    if (transaction.status !== "success") {
      order.paymentStatus = PaymentStatus.FAILED;
      await order.save();
      throw new ApiError(400, "Payment was not successful");
    }

    if (transaction.amount !== expectedAmount || transaction.currency !== "NGN") {
      order.paymentStatus = PaymentStatus.FAILED;
      await order.save();
      throw new ApiError(400, "Payment verification failed amount validation");
    }

    order.paymentStatus = PaymentStatus.PAID;
    order.status = OrderStatus.PROCESSING;
    order.paidAt = transaction.paid_at ? new Date(transaction.paid_at) : new Date();
    await order.save();
    await earningService.syncOrderEarnings(order);

    return this.serializeBuyerOrder(order);
  }

  async cancelBuyerOrder(user: CurrentUser, orderId: string) {
    this.ensureBuyer(user);
    const session = await mongoose.startSession();

    try {
      let cancelledOrder: IOrder | null = null;

      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);

        if (!order) {
          throw new ApiError(404, "Order not found");
        }

        if (user.role !== UserRole.ADMIN && order.buyerId.toString() !== user.id) {
          throw new ApiError(403, "You are not allowed to cancel this order");
        }

        const fulfillments: IOrderFulfillment[] = order.fulfillments?.length
          ? order.fulfillments
          : this.buildFulfillments(order.items, user.id);

        const canCancelImmediately = fulfillments.every(
          (fulfillment: IOrderFulfillment) => fulfillment.status === OrderStatus.PENDING
        );

        if (!canCancelImmediately) {
          throw new ApiError(400, "This order is already being fulfilled. Please request a refund instead");
        }

        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.productId,
            {
              $inc: {
                stock: item.quantity,
                soldCount: -item.quantity,
              },
            },
            { session }
          );
        }

        order.fulfillments = fulfillments.map((fulfillment: IOrderFulfillment) => ({
          ...fulfillment,
          status: OrderStatus.CANCELLED,
          updatedAt: new Date(),
          statusHistory: [
            ...(fulfillment.statusHistory || []),
            {
              status: OrderStatus.CANCELLED,
              note: "Cancelled by buyer before fulfillment started",
              updatedBy: new Types.ObjectId(user.id),
              updatedAt: new Date(),
            },
          ],
        }));
        order.status = OrderStatus.CANCELLED;

        if (order.paymentStatus === PaymentStatus.PAID) {
          await RefundRequest.findOneAndUpdate(
            {
              orderId: order._id,
              buyerId: order.buyerId,
              status: RefundRequestStatus.PENDING,
            },
            {
              $setOnInsert: {
                orderId: order._id,
                buyerId: order.buyerId,
                reason: "Order cancelled before fulfillment started",
                status: RefundRequestStatus.PENDING,
                requestedAmount: order.total,
                deductionPercent: 0,
                deductionAmount: 0,
                finalRefundAmount: order.total,
                paymentMethod: order.paymentMethod,
              },
            },
            { upsert: true, returnDocument: "after", session }
          );
        }

        await order.save({ session });
        cancelledOrder = order;
      });

      if (!cancelledOrder) {
        throw new ApiError(500, "Unable to cancel order");
      }

      this.sendOrderStatusEmailSafely({
        order: cancelledOrder,
        status: OrderStatus.CANCELLED,
        note: "Order cancelled before fulfillment started",
      });
      await earningService.syncOrderEarnings(cancelledOrder);

      return this.serializeBuyerOrder(cancelledOrder);
    } finally {
      await session.endSession();
    }
  }

  async requestBuyerRefund(user: CurrentUser, orderId: string, payload: RefundRequestPayload) {
    this.ensureBuyer(user);
    const reason = trimValue(payload.reason);

    if (!reason) {
      throw new ApiError(400, "Please provide a reason for this refund request");
    }

    const order = await Order.findById(orderId);

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    if (user.role !== UserRole.ADMIN && order.buyerId.toString() !== user.id) {
      throw new ApiError(403, "You are not allowed to request a refund for this order");
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new ApiError(400, "This order has already been cancelled");
    }

    const existingPendingRequest = await RefundRequest.findOne({
      orderId: order._id,
      buyerId: order.buyerId,
      status: RefundRequestStatus.PENDING,
    });

    if (existingPendingRequest) {
      return existingPendingRequest;
    }

    const statuses: OrderStatus[] = order.fulfillments?.length
      ? order.fulfillments.map((fulfillment: IOrderFulfillment) => fulfillment.status)
      : [order.status];
    const deductionPercent = Math.max(
      ...statuses.map((status: OrderStatus) => refundDeductionByStatus[status] ?? 10)
    );
    const deductionAmount = Math.round((order.total * deductionPercent) / 100);
    const finalRefundAmount = Math.max(order.total - deductionAmount, 0);

    return RefundRequest.create({
      orderId: order._id,
      buyerId: order.buyerId,
      reason,
      status: RefundRequestStatus.PENDING,
      requestedAmount: order.total,
      deductionPercent,
      deductionAmount,
      finalRefundAmount,
      paymentMethod: order.paymentMethod,
    });
  }

  async listSellerOrders(user: CurrentUser, query: SellerOrderQuery = {}) {
    this.ensureSeller(user);

    const sellerId = user.id;
    const page = toPositiveInteger(query.page, 1);
    const limit = toPositiveInteger(query.limit, 20, 50);
    const filter: Record<string, unknown> = {
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
      filter.createdAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    const sort = query.sort === "oldest" ? { createdAt: 1 as const } : { createdAt: -1 as const };
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      Order.find(filter).sort(sort).skip(skip).limit(limit),
      Order.countDocuments(filter),
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
  }

  async getSellerOrder(user: CurrentUser, orderId: string) {
    this.ensureSeller(user);
    const order = await Order.findById(orderId);

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    const sellerOrder = this.serializeSellerOrder(order, user.id);

    if (!sellerOrder) {
      throw new ApiError(403, "You are not allowed to view this order");
    }

    return sellerOrder;
  }

  async updateSellerOrderStatus(
    user: CurrentUser,
    orderId: string,
    payload: UpdateSellerStatusPayload
  ) {
    this.ensureSeller(user);

    const requestedStatus = payload.status;

    if (!requestedStatus || !Object.values(OrderStatus).includes(requestedStatus)) {
      throw new ApiError(400, "Please select a valid order status");
    }

    const order = await Order.findById(orderId);

    if (!order) {
      throw new ApiError(404, "Order not found");
    }

    let fulfillment: IOrderFulfillment | undefined = order.fulfillments?.find(
      (item: IOrderFulfillment) => item.vendorId.toString() === user.id
    );

    if (!fulfillment) {
      const legacyFulfillment = this.getSellerFulfillment(order, user.id);

      if (!legacyFulfillment) {
        throw new ApiError(403, "You are not allowed to update this order");
      }

      order.fulfillments = [...(order.fulfillments || []), legacyFulfillment];
      fulfillment = order.fulfillments[order.fulfillments.length - 1];
    }

    if (!fulfillment) {
      throw new ApiError(403, "You are not allowed to update this order");
    }

    if (
      order.paymentMethod === PaymentMethod.PAYSTACK &&
      order.paymentStatus !== PaymentStatus.PAID &&
      requestedStatus !== OrderStatus.CANCELLED
    ) {
      throw new ApiError(400, "Paystack orders must be paid before fulfillment can continue");
    }

    const allowedStatuses = sellerAllowedTransitions[fulfillment.status] || [];

    if (!allowedStatuses.includes(requestedStatus)) {
      throw new ApiError(
        400,
        `Cannot move order from ${fulfillment.status} to ${requestedStatus}`
      );
    }

    fulfillment.status = requestedStatus;
    fulfillment.trackingNote = trimValue(payload.note) || fulfillment.trackingNote;
    fulfillment.updatedAt = new Date();
    fulfillment.statusHistory = [
      ...(fulfillment.statusHistory || []),
      {
        status: requestedStatus,
        note: trimValue(payload.note),
        updatedBy: new Types.ObjectId(user.id),
        updatedAt: new Date(),
      },
    ];

    order.status = this.getAggregateOrderStatus(order.fulfillments || []);
    await order.save();
    await earningService.syncOrderEarnings(order);

    this.sendOrderStatusEmailSafely({
      order,
      status: requestedStatus,
      note: trimValue(payload.note),
      items: fulfillment.items,
    });

    return this.serializeSellerOrder(order, user.id);
  }
}

export const orderService = new OrderService();
