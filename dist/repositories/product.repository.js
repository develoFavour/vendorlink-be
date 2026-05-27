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
exports.productRepository = exports.ProductRepository = void 0;
const product_model_1 = require("../models/product.model");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const getSortOption = (sort) => {
    switch (sort) {
        case "oldest":
            return { createdAt: 1 };
        case "price_asc":
            return { price: 1 };
        case "price_desc":
            return { price: -1 };
        case "name_asc":
            return { name: 1 };
        case "name_desc":
            return { name: -1 };
        case "stock_asc":
            return { stock: 1 };
        case "stock_desc":
            return { stock: -1 };
        default:
            return { createdAt: -1 };
    }
};
class ProductRepository {
    create(productData) {
        return __awaiter(this, void 0, void 0, function* () {
            const product = new product_model_1.Product(productData);
            return yield product.save();
        });
    }
    findAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield product_model_1.Product.find().sort({ createdAt: -1 });
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield product_model_1.Product.findById(id);
        });
    }
    findByVendorId(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield product_model_1.Product.find({ vendorId }).sort({ createdAt: -1 });
        });
    }
    findMany(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const filter = {};
            if (query.vendorId) {
                filter.vendorId = query.vendorId;
            }
            if (query.search) {
                const regex = new RegExp(escapeRegex(query.search), "i");
                filter.$or = [
                    { name: regex },
                    { brand: regex },
                    { sku: regex },
                    { category: regex },
                    { tags: regex },
                ];
            }
            if (query.category) {
                filter.category = query.category;
            }
            if (query.status) {
                filter.status = query.status;
            }
            if (query.minPrice !== undefined || query.maxPrice !== undefined) {
                filter.price = Object.assign(Object.assign({}, (query.minPrice !== undefined ? { $gte: query.minPrice } : {})), (query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}));
            }
            const skip = (query.page - 1) * query.limit;
            const [products, total] = yield Promise.all([
                product_model_1.Product.find(filter)
                    .sort(getSortOption(query.sort))
                    .skip(skip)
                    .limit(query.limit),
                product_model_1.Product.countDocuments(filter),
            ]);
            return { products, total };
        });
    }
    updateById(id, productData) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield product_model_1.Product.findByIdAndUpdate(id, productData, {
                returnDocument: "after",
                runValidators: true,
            });
        });
    }
    deleteById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield product_model_1.Product.findByIdAndDelete(id);
        });
    }
}
exports.ProductRepository = ProductRepository;
exports.productRepository = new ProductRepository();
