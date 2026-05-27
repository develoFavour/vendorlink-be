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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImageToCloudinary = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ApiError_1 = require("./ApiError");
const getCloudinaryConfig = () => {
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (!cloudinaryUrl) {
        throw new ApiError_1.ApiError(500, "Cloudinary is not configured");
    }
    const parsed = new URL(cloudinaryUrl);
    return {
        cloudName: parsed.hostname,
        apiKey: decodeURIComponent(parsed.username),
        apiSecret: decodeURIComponent(parsed.password),
    };
};
const signUpload = (params, apiSecret) => {
    const payload = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&");
    return crypto_1.default.createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
};
const uploadImageToCloudinary = (file_1, ...args_1) => __awaiter(void 0, [file_1, ...args_1], void 0, function* (file, folder = "vendorlink/products") {
    var _a;
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const timestamp = Math.round(Date.now() / 1000).toString();
    const uploadParams = { folder, timestamp };
    const signature = signUpload(uploadParams, apiSecret);
    const body = new FormData();
    const arrayBuffer = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength);
    body.append("file", new Blob([arrayBuffer], { type: file.mimetype }), file.originalname);
    body.append("api_key", apiKey);
    body.append("timestamp", timestamp);
    body.append("folder", folder);
    body.append("signature", signature);
    const response = yield fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body,
    });
    const data = (yield response.json());
    if (!response.ok || !data.secure_url) {
        throw new ApiError_1.ApiError(502, ((_a = data.error) === null || _a === void 0 ? void 0 : _a.message) || "Cloudinary upload failed");
    }
    return data.secure_url;
});
exports.uploadImageToCloudinary = uploadImageToCloudinary;
