import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router();

router.use(protect);

router.get("/admin/overview", authorize(UserRole.ADMIN), dashboardController.getAdminOverview);
router.get("/seller/overview", authorize(UserRole.VENDOR, UserRole.ADMIN), dashboardController.getSellerOverview);

export default router;
