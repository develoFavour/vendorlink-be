import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.post("/register/buyer", authController.registerBuyer);
router.post("/register/vendor", authController.registerVendor);
router.post("/login", authController.login);
router.post("/verify-email", authController.verifyEmail);
router.post("/refresh", authController.refresh);
router.get("/me", protect, authController.me);
router.post("/logout", authController.logout);

export default router;
