import { Request, Response } from "express";
import { Store, StoreStatus } from "../models/store.model";
import { Product, ProductStatus } from "../models/product.model";

export const getVendors = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;

    const { category, search } = req.query;

    const query: any = { status: StoreStatus.ACTIVE };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { storeName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const totalStores = await Store.countDocuments(query);
    const stores = await Store.find(query)
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getVendorBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;

    const store = await Store.findOne({ slug, status: StoreStatus.ACTIVE }).select("-kyc");
    
    if (!store) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    const productsQuery = { storeId: store._id, status: ProductStatus.PUBLISHED };
    const totalProducts = await Product.countDocuments(productsQuery);
    const products = await Product.find(productsQuery)
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
