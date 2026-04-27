import crypto from "crypto";
import { ApiError } from "./ApiError";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  error?: {
    message?: string;
  };
};

const getCloudinaryConfig = (): CloudinaryConfig => {
  const cloudinaryUrl = process.env.CLOUDINARY_URL;

  if (!cloudinaryUrl) {
    throw new ApiError(500, "Cloudinary is not configured");
  }

  const parsed = new URL(cloudinaryUrl);

  return {
    cloudName: parsed.hostname,
    apiKey: decodeURIComponent(parsed.username),
    apiSecret: decodeURIComponent(parsed.password),
  };
};

const signUpload = (params: Record<string, string>, apiSecret: string) => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto.createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
};

export const uploadImageToCloudinary = async (
  file: Express.Multer.File,
  folder = "vendorlink/products"
) => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.round(Date.now() / 1000).toString();
  const uploadParams = { folder, timestamp };
  const signature = signUpload(uploadParams, apiSecret);

  const body = new FormData();
  const arrayBuffer = file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.byteLength
  ) as ArrayBuffer;

  body.append("file", new Blob([arrayBuffer], { type: file.mimetype }), file.originalname);
  body.append("api_key", apiKey);
  body.append("timestamp", timestamp);
  body.append("folder", folder);
  body.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });

  const data = (await response.json()) as CloudinaryUploadResponse;

  if (!response.ok || !data.secure_url) {
    throw new ApiError(502, data.error?.message || "Cloudinary upload failed");
  }

  return data.secure_url;
};
