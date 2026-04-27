import mongoose, { Schema, Document, Types } from "mongoose";

export enum ProductStatus {
  PUBLISHED = "Published",
  DRAFT = "Draft",
}

export interface IProduct extends Document {
  _id: Types.ObjectId;
  vendorId: Types.ObjectId;
  storeId?: Types.ObjectId;
  name: string;
  brand?: string;
  shortDescription?: string;
  description?: string;
  price: number;
  compareAtPrice?: number;
  discountPercent?: number;
  stock: number;
  soldCount: number;
  category: string;
  status: ProductStatus;
  image: string;
  gallery: string[];
  color?: string;
  sku?: string;
  weight?: string;
  deliveryNote?: string;
  sizes: string[];
  tags: string[];
  specifications?: {
    material?: string;
    care?: string;
    packageDimensions?: string;
    department?: string;
    protection?: string;
    dateFirstAvailable?: string;
  };
  stylingIdeas: {
    name: string;
    price: number;
    image?: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
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
  },
  {
    timestamps: true,
  }
);

export const Product =
  mongoose.models.Product || mongoose.model<IProduct>("Product", productSchema);
