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
exports.adminService = void 0;
const mongoose_1 = require("mongoose");
const product_model_1 = require("../models/product.model");
const store_model_1 = require("../models/store.model");
const user_model_1 = require("../models/user.model");
const ApiError_1 = require("../utils/ApiError");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toPositiveInteger = (value, fallback, max = 100) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1)
        return fallback;
    return Math.min(parsed, max);
};
class AdminService {
    ensureAdmin(user) {
        if (user.role !== user_model_1.UserRole.ADMIN) {
            throw new ApiError_1.ApiError(403, "Only admins can perform this action");
        }
    }
    ensureObjectId(id, label) {
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            throw new ApiError_1.ApiError(400, `Invalid ${label}`);
        }
    }
    serializeUser(user) {
        const plain = user.toObject ? user.toObject() : user;
        delete plain.password;
        delete plain.emailVerificationToken;
        delete plain.emailVerificationExpires;
        return Object.assign(Object.assign({}, plain), { accountStatus: plain.accountStatus || user_model_1.UserAccountStatus.ACTIVE });
    }
    serializeStore(store, productCount = 0) {
        const plain = store.toObject ? store.toObject() : store;
        const vendor = plain.vendorId;
        return {
            _id: plain._id,
            vendorId: vendor,
            vendorName: (vendor === null || vendor === void 0 ? void 0 : vendor.fullName) || "Vendor",
            vendorEmail: (vendor === null || vendor === void 0 ? void 0 : vendor.email) || "",
            vendorStatus: (vendor === null || vendor === void 0 ? void 0 : vendor.accountStatus) || user_model_1.UserAccountStatus.ACTIVE,
            storeName: plain.storeName,
            slug: plain.slug,
            category: plain.category,
            address: plain.address || "",
            status: plain.status,
            productCount,
            createdAt: plain.createdAt,
            updatedAt: plain.updatedAt,
        };
    }
    listUsers(user_1) {
        return __awaiter(this, arguments, void 0, function* (user, query = {}) {
            this.ensureAdmin(user);
            const page = toPositiveInteger(query.page, 1);
            const limit = toPositiveInteger(query.limit, 20, 50);
            const filter = {};
            if (query.role && query.role !== "All") {
                filter.role = query.role;
            }
            if (query.status && query.status !== "All") {
                filter.accountStatus = query.status;
            }
            if (query.search) {
                const regex = new RegExp(escapeRegex(query.search), "i");
                filter.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
            }
            const sort = query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
            const [users, total] = yield Promise.all([
                user_model_1.User.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
                user_model_1.User.countDocuments(filter),
            ]);
            return {
                users: users.map((item) => this.serializeUser(item)),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.max(Math.ceil(total / limit), 1),
                    hasNextPage: page * limit < total,
                    hasPrevPage: page > 1,
                },
            };
        });
    }
    updateUserStatus(user, targetUserId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureAdmin(user);
            this.ensureObjectId(targetUserId, "user id");
            if (!Object.values(user_model_1.UserAccountStatus).includes(status)) {
                throw new ApiError_1.ApiError(400, "Please select a valid account status");
            }
            if (targetUserId === user.id && status === user_model_1.UserAccountStatus.SUSPENDED) {
                throw new ApiError_1.ApiError(400, "You cannot suspend your own admin account");
            }
            const targetUser = yield user_model_1.User.findById(targetUserId);
            if (!targetUser) {
                throw new ApiError_1.ApiError(404, "User not found");
            }
            targetUser.accountStatus = status;
            yield targetUser.save();
            if (targetUser.role === user_model_1.UserRole.VENDOR) {
                yield store_model_1.Store.findOneAndUpdate({ vendorId: targetUser._id }, {
                    status: status === user_model_1.UserAccountStatus.SUSPENDED
                        ? store_model_1.StoreStatus.SUSPENDED
                        : store_model_1.StoreStatus.ACTIVE,
                });
            }
            return this.serializeUser(targetUser);
        });
    }
    listVendors(user_1) {
        return __awaiter(this, arguments, void 0, function* (user, query = {}) {
            this.ensureAdmin(user);
            const page = toPositiveInteger(query.page, 1);
            const limit = toPositiveInteger(query.limit, 20, 50);
            const filter = {};
            if (query.status && query.status !== "All") {
                filter.status = query.status;
            }
            if (query.search) {
                const regex = new RegExp(escapeRegex(query.search), "i");
                const vendors = yield user_model_1.User.find({
                    role: user_model_1.UserRole.VENDOR,
                    $or: [{ fullName: regex }, { email: regex }],
                }).select("_id");
                filter.$or = [
                    { storeName: regex },
                    { slug: regex },
                    { category: regex },
                    { address: regex },
                    { vendorId: { $in: vendors.map((vendor) => vendor._id) } },
                ];
            }
            const sort = query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
            const [stores, total] = yield Promise.all([
                store_model_1.Store.find(filter)
                    .populate("vendorId", "fullName email phone accountStatus isVerified createdAt")
                    .sort(sort)
                    .skip((page - 1) * limit)
                    .limit(limit),
                store_model_1.Store.countDocuments(filter),
            ]);
            const productCounts = yield product_model_1.Product.aggregate([
                { $match: { vendorId: { $in: stores.map((store) => { var _a; return ((_a = store.vendorId) === null || _a === void 0 ? void 0 : _a._id) || store.vendorId; }) } } },
                { $group: { _id: "$vendorId", count: { $sum: 1 } } },
            ]);
            const productCountMap = new Map(productCounts.map((item) => [item._id.toString(), item.count]));
            return {
                vendors: stores.map((store) => {
                    var _a, _b;
                    const vendorId = ((_b = (_a = store.vendorId) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) || store.vendorId.toString();
                    return this.serializeStore(store, productCountMap.get(vendorId) || 0);
                }),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.max(Math.ceil(total / limit), 1),
                    hasNextPage: page * limit < total,
                    hasPrevPage: page > 1,
                },
            };
        });
    }
    updateVendorStatus(user, storeId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            this.ensureAdmin(user);
            this.ensureObjectId(storeId, "store id");
            if (!Object.values(store_model_1.StoreStatus).includes(status)) {
                throw new ApiError_1.ApiError(400, "Please select a valid vendor status");
            }
            const store = yield store_model_1.Store.findById(storeId);
            if (!store) {
                throw new ApiError_1.ApiError(404, "Vendor store not found");
            }
            store.status = status;
            yield store.save();
            yield user_model_1.User.findByIdAndUpdate(store.vendorId, {
                accountStatus: status === store_model_1.StoreStatus.SUSPENDED
                    ? user_model_1.UserAccountStatus.SUSPENDED
                    : user_model_1.UserAccountStatus.ACTIVE,
            });
            const populated = yield store_model_1.Store.findById(store._id).populate("vendorId", "fullName email phone accountStatus isVerified createdAt");
            return this.serializeStore(populated || store);
        });
    }
}
exports.adminService = new AdminService();
