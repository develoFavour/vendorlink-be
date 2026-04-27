import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { cartService } from "../services/cart.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export class CartController {
  private getParamId(req: AuthenticatedRequest): string {
    const id = req.params.productId;
    return Array.isArray(id) ? id[0] : id;
  }

  public getCart = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const cart = await cartService.getCart(req.user!);
    return res.status(200).json(new ApiResponse(200, cart, "Cart fetched successfully"));
  });

  public addToCart = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const cart = await cartService.addToCart(req.user!, this.getParamId(req), req.body.quantity);
    return res.status(200).json(new ApiResponse(200, cart, "Product added to cart"));
  });

  public updateCartItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const cart = await cartService.updateCartItem(req.user!, this.getParamId(req), req.body.quantity);
    return res.status(200).json(new ApiResponse(200, cart, "Cart item updated"));
  });

  public removeFromCart = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const cart = await cartService.removeFromCart(req.user!, this.getParamId(req));
    return res.status(200).json(new ApiResponse(200, cart, "Product removed from cart"));
  });

  public clearCart = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const cart = await cartService.clearCart(req.user!);
    return res.status(200).json(new ApiResponse(200, cart, "Cart cleared"));
  });
}

export const cartController = new CartController();
