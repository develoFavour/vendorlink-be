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
exports.getVendorBySlug = exports.getVendors = void 0;
const store_model_1 = require("../models/store.model");
const product_model_1 = require("../models/product.model");
const getVendors = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const { category, search } = req.query;
        const query = { status: store_model_1.StoreStatus.ACTIVE };
        if (category) {
            query.category = category;
        }
        if (search) {
            query.$or = [
                { storeName: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } },
            ];
        }
        const totalStores = yield store_model_1.Store.countDocuments(query);
        const stores = yield store_model_1.Store.find(query)
            .select("-kyc") // exclude sensitive kyc data
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        res.status(200).json({
            success: true,
            data: {
                stores,
                pagination: {
                    total: totalStores,
                    page,
                    limit,
                    totalPages: Math.ceil(totalStores / limit),
                },
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getVendors = getVendors;
const getVendorBySlug = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { slug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const store = yield store_model_1.Store.findOne({ slug, status: store_model_1.StoreStatus.ACTIVE }).select("-kyc");
        if (!store) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }
        const productsQuery = { storeId: store._id, status: product_model_1.ProductStatus.PUBLISHED };
        const totalProducts = yield product_model_1.Product.countDocuments(productsQuery);
        const products = yield product_model_1.Product.find(productsQuery)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        res.status(200).json({
            success: true,
            data: {
                store,
                products,
                pagination: {
                    total: totalProducts,
                    page,
                    limit,
                    totalPages: Math.ceil(totalProducts / limit),
                },
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.getVendorBySlug = getVendorBySlug;
