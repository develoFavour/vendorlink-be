import { Router } from "express";
import { productController } from "../controllers/product.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { productImageUpload } from "../middleware/upload.middleware";
import { UserRole } from "../models/user.model";

const router = Router();

router.get("/public", productController.getPublicProducts);
router.get("/public/:id", productController.getPublicProductById);

router.use(protect);

router
  .route("/")
  .get(authorize(UserRole.VENDOR, UserRole.ADMIN), productController.getVendorProducts)
  .post(authorize(UserRole.VENDOR, UserRole.ADMIN), productImageUpload, productController.createProduct);

router
  .route("/:id")
  .get(authorize(UserRole.VENDOR, UserRole.ADMIN), productController.getProductById)
  .patch(authorize(UserRole.VENDOR, UserRole.ADMIN), productImageUpload, productController.updateProduct)
  .delete(authorize(UserRole.VENDOR, UserRole.ADMIN), productController.deleteProduct);

export default router;
