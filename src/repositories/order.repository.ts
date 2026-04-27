import { Order, IOrder } from "../models/order.model";

export class OrderRepository {
  async create(orderData: Partial<IOrder>): Promise<IOrder> {
    const order = new Order(orderData);
    return await order.save();
  }

  async findAll(): Promise<IOrder[]> {
    return await Order.find().sort({ createdAt: -1 });
  }

  async findByBuyerId(buyerId: string): Promise<IOrder[]> {
    return await Order.find({ buyerId }).sort({ createdAt: -1 });
  }

  async findById(id: string): Promise<IOrder | null> {
    return await Order.findById(id);
  }

  async findByPaymentReference(reference: string): Promise<IOrder | null> {
    return await Order.findOne({ paymentReference: reference });
  }
}

export const orderRepository = new OrderRepository();
