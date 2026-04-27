import { ProductStatus } from "../models/product.model";
import { UserRole } from "../models/user.model";
import { productRepository } from "../repositories/product.repository";
import { wishlistRepository } from "../repositories/wishlist.repository";
import { ApiError } from "../utils/ApiError";

type CurrentUser = {
  id: string;
  role: UserRole;
};

class WishlistService {
  private ensureBuyer(user: CurrentUser) {
    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only buyers can manage wishlists");
    }
  }

  private async ensurePublishedProduct(productId: string) {
    const product = await productRepository.findById(productId);

    if (!product || product.status !== ProductStatus.PUBLISHED) {
      throw new ApiError(404, "Product not found");
    }

    return product;
  }

  async getWishlist(user: CurrentUser) {
    this.ensureBuyer(user);
    const items = await wishlistRepository.findByUserId(user.id);

    return {
      items,
      productIds: items.map((item) => item.productId._id.toString()),
      count: items.length,
    };
  }

  async addToWishlist(user: CurrentUser, productId: string) {
    this.ensureBuyer(user);
    await this.ensurePublishedProduct(productId);
    await wishlistRepository.add(user.id, productId);

    return await this.getWishlist(user);
  }

  async removeFromWishlist(user: CurrentUser, productId: string) {
    this.ensureBuyer(user);
    await wishlistRepository.remove(user.id, productId);

    return await this.getWishlist(user);
  }
}

export const wishlistService = new WishlistService();
