import { Router } from "express";
import { orderController } from "../controllers/order.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router();

router.use(protect);

router.get("/admin", authorize(UserRole.ADMIN), orderController.getAdminOrders);
router.get("/", authorize(UserRole.BUYER, UserRole.ADMIN), orderController.getOrders);
router.post("/checkout", authorize(UserRole.BUYER, UserRole.ADMIN), orderController.checkout);
router.get("/paystack/verify/:reference", authorize(UserRole.BUYER, UserRole.ADMIN), orderController.verifyPaystackPayment);
router.patch("/:id/cancel", authorize(UserRole.BUYER, UserRole.ADMIN), orderController.cancelBuyerOrder);
router.post("/:id/refund-requests", authorize(UserRole.BUYER, UserRole.ADMIN), orderController.requestBuyerRefund);
router.get("/seller", authorize(UserRole.VENDOR, UserRole.ADMIN), orderController.getSellerOrders);
router.get("/seller/:id", authorize(UserRole.VENDOR, UserRole.ADMIN), orderController.getSellerOrder);
router.patch("/seller/:id/status", authorize(UserRole.VENDOR, UserRole.ADMIN), orderController.updateSellerOrderStatus);
router.get("/:id", authorize(UserRole.BUYER, UserRole.ADMIN), orderController.getOrder);

export default router;
