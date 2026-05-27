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
exports.productController = exports.ProductController = void 0;
const product_service_1 = require("../services/product.service");
const asyncHandler_1 = require("../utils/asyncHandler");
const ApiResponse_1 = require("../utils/ApiResponse");
const cloudinary_1 = require("../utils/cloudinary");
class ProductController {
    constructor() {
        this.createProduct = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const product = yield product_service_1.productService.createProduct(req.user, yield this.buildProductPayload(req));
            return res.status(201).json(new ApiResponse_1.ApiResponse(201, product, "Product created successfully"));
        }));
        this.getVendorProducts = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const products = yield product_service_1.productService.getVendorProducts(req.user, req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, products, "Products fetched successfully"));
        }));
        this.getPublicProducts = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const products = yield product_service_1.productService.getPublicProducts(req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, products, "Products fetched successfully"));
        }));
        this.getProductById = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const product = yield product_service_1.productService.getProductById(this.getParamId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, product, "Product fetched successfully"));
        }));
        this.getPublicProductById = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const product = yield product_service_1.productService.getPublicProductById(this.getParamId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, product, "Product fetched successfully"));
        }));
        this.updateProduct = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const product = yield product_service_1.productService.updateProduct(req.user, this.getParamId(req), yield this.buildProductPayload(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, product, "Product updated successfully"));
        }));
        this.deleteProduct = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            yield product_service_1.productService.deleteProduct(req.user, this.getParamId(req));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, null, "Product deleted successfully"));
        }));
    }
    getParamId(req) {
        const id = req.params.id;
        return Array.isArray(id) ? id[0] : id;
    }
    buildProductPayload(req) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const files = req.files;
            const payload = Object.assign({}, req.body);
            if ((_a = files === null || files === void 0 ? void 0 : files.imageFile) === null || _a === void 0 ? void 0 : _a[0]) {
                payload.image = yield (0, cloudinary_1.uploadImageToCloudinary)(files.imageFile[0]);
            }
            if ((_b = files === null || files === void 0 ? void 0 : files.galleryFiles) === null || _b === void 0 ? void 0 : _b.length) {
                const uploadedGallery = yield Promise.all(files.galleryFiles.map((file) => (0, cloudinary_1.uploadImageToCloudinary)(file)));
                payload.gallery = [payload.gallery, ...uploadedGallery].filter(Boolean).join(",");
            }
            return payload;
        });
    }
}
exports.ProductController = ProductController;
exports.productController = new ProductController();
