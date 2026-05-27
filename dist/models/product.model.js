"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = exports.ProductStatus = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ProductStatus;
(function (ProductStatus) {
    ProductStatus["PUBLISHED"] = "Published";
    ProductStatus["DRAFT"] = "Draft";
})(ProductStatus || (exports.ProductStatus = ProductStatus = {}));
const productSchema = new mongoose_1.Schema({
    vendorId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    storeId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Store",
    },
    name: {
        type: String,
        required: [true, "Product name is required"],
        trim: true,
    },
    brand: { type: String, trim: true },
    shortDescription: { type: String, trim: true },
    description: { type: String, trim: true },
    price: {
        type: Number,
        required: [true, "Product price is required"],
        min: 0,
    },
    compareAtPrice: { type: Number, min: 0 },
    discountPercent: { type: Number, min: 0, max: 100 },
    stock: {
        type: Number,
        required: [true, "Product stock is required"],
        min: 0,
        default: 0,
    },
    soldCount: {
        type: Number,
        min: 0,
        default: 0,
    },
    category: {
        type: String,
        required: [true, "Product category is required"],
        trim: true,
    },
    status: {
        type: String,
        enum: Object.values(ProductStatus),
        default: ProductStatus.DRAFT,
    },
    image: {
        type: String,
        required: [true, "Product image is required"],
        trim: true,
    },
    gallery: {
        type: [String],
        default: [],
    },
    color: { type: String, trim: true },
    sku: { type: String, trim: true },
    weight: { type: String, trim: true },
    deliveryNote: { type: String, trim: true },
    sizes: {
        type: [String],
        default: [],
    },
    tags: {
        type: [String],
        default: [],
    },
    specifications: {
        material: String,
        care: String,
        packageDimensions: String,
        department: String,
        protection: String,
        dateFirstAvailable: String,
    },
    stylingIdeas: {
        type: [
            {
                name: String,
                price: Number,
                image: String,
            },
        ],
        default: [],
    },
}, {
    timestamps: true,
});
exports.Product = mongoose_1.default.models.Product || mongoose_1.default.model("Product", productSchema);
