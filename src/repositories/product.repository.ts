import { Product, IProduct } from "../models/product.model";

export type ProductListQuery = {
  vendorId?: string;
  search?: string;
  category?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  page: number;
  limit: number;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getSortOption = (sort?: string): Record<string, 1 | -1> => {
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

export class ProductRepository {
  async create(productData: Partial<IProduct>): Promise<IProduct> {
    const product = new Product(productData);
    return await product.save();
  }

  async findAll(): Promise<IProduct[]> {
    return await Product.find().sort({ createdAt: -1 });
  }

  async findById(id: string): Promise<IProduct | null> {
    return await Product.findById(id);
  }

  async findByVendorId(vendorId: string): Promise<IProduct[]> {
    return await Product.find({ vendorId }).sort({ createdAt: -1 });
  }

  async findMany(query: ProductListQuery): Promise<{ products: IProduct[]; total: number }> {
    const filter: Record<string, unknown> = {};

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
      filter.price = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }

    const skip = (query.page - 1) * query.limit;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(getSortOption(query.sort))
        .skip(skip)
        .limit(query.limit),
      Product.countDocuments(filter),
    ]);

    return { products, total };
  }

  async updateById(id: string, productData: Partial<IProduct>): Promise<IProduct | null> {
    return await Product.findByIdAndUpdate(id, productData, {
      returnDocument: "after",
      runValidators: true,
    });
  }

  async deleteById(id: string): Promise<IProduct | null> {
    return await Product.findByIdAndDelete(id);
  }
}

export const productRepository = new ProductRepository();
