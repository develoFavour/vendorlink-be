import { Types } from "mongoose";
import { Product } from "../models/product.model";
import { Store, StoreStatus } from "../models/store.model";
import { User, UserAccountStatus, UserRole } from "../models/user.model";
import { ApiError } from "../utils/ApiError";

type CurrentUser = {
  id: string;
  role: UserRole;
};

type AdminListQuery = {
  search?: string;
  role?: UserRole | "All";
  status?: UserAccountStatus | StoreStatus | "All";
  page?: string | number;
  limit?: string | number;
  sort?: string;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toPositiveInteger = (value: unknown, fallback: number, max = 100) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

class AdminService {
  private ensureAdmin(user: CurrentUser) {
    if (user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only admins can perform this action");
    }
  }

  private ensureObjectId(id: string, label: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(400, `Invalid ${label}`);
    }
  }

  private serializeUser(user: any) {
    const plain = user.toObject ? user.toObject() : user;
    delete plain.password;
    delete plain.emailVerificationToken;
    delete plain.emailVerificationExpires;

    return {
      ...plain,
      accountStatus: plain.accountStatus || UserAccountStatus.ACTIVE,
    };
  }

  private serializeStore(store: any, productCount = 0) {
    const plain = store.toObject ? store.toObject() : store;
    const vendor = plain.vendorId;

    return {
      _id: plain._id,
      vendorId: vendor,
      vendorName: vendor?.fullName || "Vendor",
      vendorEmail: vendor?.email || "",
      vendorStatus: vendor?.accountStatus || UserAccountStatus.ACTIVE,
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

  async listUsers(user: CurrentUser, query: AdminListQuery = {}) {
    this.ensureAdmin(user);

    const page = toPositiveInteger(query.page, 1);
    const limit = toPositiveInteger(query.limit, 20, 50);
    const filter: Record<string, unknown> = {};

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

    const sort = query.sort === "oldest" ? { createdAt: 1 as const } : { createdAt: -1 as const };
    const [users, total] = await Promise.all([
      User.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
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
  }

  async updateUserStatus(
    user: CurrentUser,
    targetUserId: string,
    status: UserAccountStatus
  ) {
    this.ensureAdmin(user);
    this.ensureObjectId(targetUserId, "user id");

    if (!Object.values(UserAccountStatus).includes(status)) {
      throw new ApiError(400, "Please select a valid account status");
    }

    if (targetUserId === user.id && status === UserAccountStatus.SUSPENDED) {
      throw new ApiError(400, "You cannot suspend your own admin account");
    }

    const targetUser = await User.findById(targetUserId);

    if (!targetUser) {
      throw new ApiError(404, "User not found");
    }

    targetUser.accountStatus = status;
    await targetUser.save();

    if (targetUser.role === UserRole.VENDOR) {
      await Store.findOneAndUpdate(
        { vendorId: targetUser._id },
        {
          status:
            status === UserAccountStatus.SUSPENDED
              ? StoreStatus.SUSPENDED
              : StoreStatus.ACTIVE,
        }
      );
    }

    return this.serializeUser(targetUser);
  }

  async listVendors(user: CurrentUser, query: AdminListQuery = {}) {
    this.ensureAdmin(user);

    const page = toPositiveInteger(query.page, 1);
    const limit = toPositiveInteger(query.limit, 20, 50);
    const filter: Record<string, unknown> = {};

    if (query.status && query.status !== "All") {
      filter.status = query.status;
    }

    if (query.search) {
      const regex = new RegExp(escapeRegex(query.search), "i");
      const vendors = await User.find({
        role: UserRole.VENDOR,
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

    const sort = query.sort === "oldest" ? { createdAt: 1 as const } : { createdAt: -1 as const };
    const [stores, total] = await Promise.all([
      Store.find(filter)
        .populate("vendorId", "fullName email phone accountStatus isVerified createdAt")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Store.countDocuments(filter),
    ]);

    const productCounts = await Product.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { vendorId: { $in: stores.map((store) => store.vendorId?._id || store.vendorId) } } },
      { $group: { _id: "$vendorId", count: { $sum: 1 } } },
    ]);
    const productCountMap = new Map(productCounts.map((item) => [item._id.toString(), item.count]));

    return {
      vendors: stores.map((store) => {
        const vendorId = (store.vendorId as any)?._id?.toString() || store.vendorId.toString();
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
  }

  async updateVendorStatus(user: CurrentUser, storeId: string, status: StoreStatus) {
    this.ensureAdmin(user);
    this.ensureObjectId(storeId, "store id");

    if (!Object.values(StoreStatus).includes(status)) {
      throw new ApiError(400, "Please select a valid vendor status");
    }

    const store = await Store.findById(storeId);

    if (!store) {
      throw new ApiError(404, "Vendor store not found");
    }

    store.status = status;
    await store.save();

    await User.findByIdAndUpdate(store.vendorId, {
      accountStatus:
        status === StoreStatus.SUSPENDED
          ? UserAccountStatus.SUSPENDED
          : UserAccountStatus.ACTIVE,
    });

    const populated = await Store.findById(store._id).populate(
      "vendorId",
      "fullName email phone accountStatus isVerified createdAt"
    );

    return this.serializeStore(populated || store);
  }
}

export const adminService = new AdminService();
