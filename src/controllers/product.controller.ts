import { Response } from "express";
import { productService } from "../services/product.service";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { uploadImageToCloudinary } from "../utils/cloudinary";

type ProductImageFiles = {
  imageFile?: Express.Multer.File[];
  galleryFiles?: Express.Multer.File[];
};

export class ProductController {
  private getParamId(req: AuthenticatedRequest): string {
    const id = req.params.id;
    return Array.isArray(id) ? id[0] : id;
  }

  private async buildProductPayload(req: AuthenticatedRequest) {
    const files = req.files as ProductImageFiles | undefined;
    const payload = { ...req.body };

    if (files?.imageFile?.[0]) {
      payload.image = await uploadImageToCloudinary(files.imageFile[0]);
    }

    if (files?.galleryFiles?.length) {
      const uploadedGallery = await Promise.all(
        files.galleryFiles.map((file) => uploadImageToCloudinary(file))
      );

      payload.gallery = [payload.gallery, ...uploadedGallery].filter(Boolean).join(",");
    }

    return payload;
  }

  public createProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const product = await productService.createProduct(req.user!, await this.buildProductPayload(req));
    return res.status(201).json(new ApiResponse(201, product, "Product created successfully"));
  });

  public getVendorProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const products = await productService.getVendorProducts(req.user!, req.query);
    return res.status(200).json(new ApiResponse(200, products, "Products fetched successfully"));
  });

  public getPublicProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const products = await productService.getPublicProducts(req.query);
    return res.status(200).json(new ApiResponse(200, products, "Products fetched successfully"));
  });

  public getProductById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const product = await productService.getProductById(this.getParamId(req));
    return res.status(200).json(new ApiResponse(200, product, "Product fetched successfully"));
  });

  public getPublicProductById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const product = await productService.getPublicProductById(this.getParamId(req));
    return res.status(200).json(new ApiResponse(200, product, "Product fetched successfully"));
  });

  public updateProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const product = await productService.updateProduct(req.user!, this.getParamId(req), await this.buildProductPayload(req));
    return res.status(200).json(new ApiResponse(200, product, "Product updated successfully"));
  });

  public deleteProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await productService.deleteProduct(req.user!, this.getParamId(req));
    return res.status(200).json(new ApiResponse(200, null, "Product deleted successfully"));
  });
}

export const productController = new ProductController();
