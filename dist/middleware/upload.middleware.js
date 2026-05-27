"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.productImageUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const ApiError_1 = require("../utils/ApiError");
const storage = multer_1.default.memoryStorage();
exports.productImageUpload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 6,
    },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new ApiError_1.ApiError(400, "Only image files can be uploaded"));
            return;
        }
        cb(null, true);
    },
}).fields([
    { name: "imageFile", maxCount: 1 },
    { name: "galleryFiles", maxCount: 5 },
]);
