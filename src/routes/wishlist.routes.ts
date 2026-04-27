import { Router } from "express";
import { wishlistController } from "../controllers/wishlist.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router();

router.use(protect, authorize(UserRole.BUYER, UserRole.ADMIN));

router.get("/", wishlistController.getWishlist);
router.post("/:productId", wishlistController.addToWishlist);
router.delete("/:productId", wishlistController.removeFromWishlist);

export default router;
