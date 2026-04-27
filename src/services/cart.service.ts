import { Types } from "mongoose";
import { ICart } from "../models/cart.model";
import { ProductStatus, IProduct } from "../models/product.model";
import { UserRole } from "../models/user.model";
import { cartRepository } from "../repositories/cart.repository";
import { productRepository } from "../repositories/product.repository";
import { ApiError } from "../utils/ApiError";

type CurrentUser = {
  id: string;
  role: UserRole;
};

type PopulatedCartItem = {
  productId: IProduct;
  quantity: number;
};

const toPositiveQuantity = (value: unknown, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
};

class CartService {
  private ensureBuyer(user: CurrentUser) {
    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only buyers can manage carts");
    }
  }

  private async ensurePurchasableProduct(productId: string) {
    const product = await productRepository.findById(productId);

    if (!product || product.status !== ProductStatus.PUBLISHED) {
      throw new ApiError(404, "Product not found");
    }

    if (product.stock < 1) {
      throw new ApiError(400, "Product is out of stock");
    }

    return product;
  }

  private serializeCart(cart: ICart | null) {
    if (!cart) {
      return { items: [], count: 0, subtotal: 0 };
    }

    const items = (cart.items as unknown as PopulatedCartItem[])
      .filter((item) => item.productId)
      .map((item) => ({
        product: item.productId,
        quantity: item.quantity,
        lineTotal: item.productId.price * item.quantity,
      }));

    return {
      items,
      count: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
    };
  }

  async getCart(user: CurrentUser) {
    this.ensureBuyer(user);
    const cart = await cartRepository.findByUserId(user.id);
    return this.serializeCart(cart);
  }

  async addToCart(user: CurrentUser, productId: string, quantityValue: unknown) {
    this.ensureBuyer(user);
    const product = await this.ensurePurchasableProduct(productId);
    const quantity = toPositiveQuantity(quantityValue);
    const cart = await cartRepository.getOrCreate(user.id);
    const existingItem = cart.items.find((item) => item.productId.toString() === productId);

    if (existingItem) {
      existingItem.quantity = Math.min(existingItem.quantity + quantity, product.stock);
    } else {
      cart.items.push({
        productId: new Types.ObjectId(productId),
        quantity: Math.min(quantity, product.stock),
      });
    }

    return this.serializeCart(await cartRepository.save(cart));
  }

  async updateCartItem(user: CurrentUser, productId: string, quantityValue: unknown) {
    this.ensureBuyer(user);
    const product = await this.ensurePurchasableProduct(productId);
    const quantity = toPositiveQuantity(quantityValue);
    const cart = await cartRepository.getOrCreate(user.id);
    const existingItem = cart.items.find((item) => item.productId.toString() === productId);

    if (!existingItem) {
      throw new ApiError(404, "Cart item not found");
    }

    existingItem.quantity = Math.min(quantity, product.stock);
    return this.serializeCart(await cartRepository.save(cart));
  }

  async removeFromCart(user: CurrentUser, productId: string) {
    this.ensureBuyer(user);
    const cart = await cartRepository.getOrCreate(user.id);
    cart.items = cart.items.filter((item) => item.productId.toString() !== productId);

    return this.serializeCart(await cartRepository.save(cart));
  }

  async clearCart(user: CurrentUser) {
    this.ensureBuyer(user);
    return this.serializeCart(await cartRepository.clear(user.id));
  }
}

export const cartService = new CartService();
