import multer from "multer";
import { ApiError } from "../utils/ApiError";

const storage = multer.memoryStorage();

export const productImageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 6,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new ApiError(400, "Only image files can be uploaded"));
      return;
    }

    cb(null, true);
  },
}).fields([
  { name: "imageFile", maxCount: 1 },
  { name: "galleryFiles", maxCount: 5 },
]);
