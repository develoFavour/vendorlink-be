import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { wishlistService } from "../services/wishlist.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export class WishlistController {
  private getParamId(req: AuthenticatedRequest): string {
    const id = req.params.productId;
    return Array.isArray(id) ? id[0] : id;
  }

  public getWishlist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const wishlist = await wishlistService.getWishlist(req.user!);
    return res.status(200).json(new ApiResponse(200, wishlist, "Wishlist fetched successfully"));
  });

  public addToWishlist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const wishlist = await wishlistService.addToWishlist(req.user!, this.getParamId(req));
    return res.status(200).json(new ApiResponse(200, wishlist, "Product added to wishlist"));
  });

  public removeFromWishlist = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const wishlist = await wishlistService.removeFromWishlist(req.user!, this.getParamId(req));
    return res.status(200).json(new ApiResponse(200, wishlist, "Product removed from wishlist"));
  });
}

export const wishlistController = new WishlistController();
