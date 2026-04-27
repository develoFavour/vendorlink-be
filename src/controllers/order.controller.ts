import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { orderService } from "../services/order.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export class OrderController {
  private getParamId(req: AuthenticatedRequest): string {
    const id = req.params.id;
    return Array.isArray(id) ? id[0] : id;
  }

  public getOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const orders = await orderService.listOrders(req.user!);
    return res.status(200).json(new ApiResponse(200, orders, "Orders fetched successfully"));
  });

  public getAdminOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await orderService.listAdminOrders(req.user!, req.query);
    return res.status(200).json(new ApiResponse(200, result, "Admin orders fetched successfully"));
  });

  public getOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await orderService.getOrder(req.user!, this.getParamId(req));
    return res.status(200).json(new ApiResponse(200, order, "Order fetched successfully"));
  });

  public checkout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await orderService.checkout(req.user!, req.body);
    return res.status(201).json(new ApiResponse(201, result, "Order placed successfully"));
  });

  public verifyPaystackPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const reference = req.params.reference;
    const normalizedReference = Array.isArray(reference) ? reference[0] : reference;
    const order = await orderService.verifyPaystackPayment(req.user!, normalizedReference);
    return res.status(200).json(new ApiResponse(200, order, "Payment verified successfully"));
  });

  public cancelBuyerOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await orderService.cancelBuyerOrder(req.user!, this.getParamId(req));
    return res.status(200).json(new ApiResponse(200, order, "Order cancelled successfully"));
  });

  public requestBuyerRefund = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const refundRequest = await orderService.requestBuyerRefund(req.user!, this.getParamId(req), req.body);
    return res.status(201).json(new ApiResponse(201, refundRequest, "Refund request submitted successfully"));
  });

  public getSellerOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await orderService.listSellerOrders(req.user!, req.query);
    return res.status(200).json(new ApiResponse(200, result, "Seller orders fetched successfully"));
  });

  public getSellerOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await orderService.getSellerOrder(req.user!, this.getParamId(req));
    return res.status(200).json(new ApiResponse(200, order, "Seller order fetched successfully"));
  });

  public updateSellerOrderStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const order = await orderService.updateSellerOrderStatus(req.user!, this.getParamId(req), req.body);
    return res.status(200).json(new ApiResponse(200, order, "Seller order status updated"));
  });
}

export const orderController = new OrderController();
