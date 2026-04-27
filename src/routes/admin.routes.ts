import { Router } from "express";
import { adminController } from "../controllers/admin.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router();

router.use(protect, authorize(UserRole.ADMIN));

router.get("/users", adminController.listUsers);
router.patch("/users/:userId/status", adminController.updateUserStatus);

router.get("/vendors", adminController.listVendors);
router.patch("/vendors/:storeId/status", adminController.updateVendorStatus);

export default router;
