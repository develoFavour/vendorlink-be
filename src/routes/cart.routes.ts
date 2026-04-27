import { Router } from "express";
import { cartController } from "../controllers/cart.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router();

router.use(protect, authorize(UserRole.BUYER, UserRole.ADMIN));

router.get("/", cartController.getCart);
router.delete("/", cartController.clearCart);
router.post("/items/:productId", cartController.addToCart);
router.patch("/items/:productId", cartController.updateCartItem);
router.delete("/items/:productId", cartController.removeFromCart);

export default router;
