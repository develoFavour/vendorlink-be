import { Router } from "express";
import { earningController } from "../controllers/earning.controller";
import { authorize, protect } from "../middleware/auth.middleware";
import { UserRole } from "../models/user.model";

const router = Router();

router.use(protect);

router.get("/seller/overview", authorize(UserRole.VENDOR, UserRole.ADMIN), earningController.getSellerOverview);
router.get("/seller", authorize(UserRole.VENDOR, UserRole.ADMIN), earningController.listSellerEarnings);
router.post("/seller/withdrawals", authorize(UserRole.VENDOR, UserRole.ADMIN), earningController.requestWithdrawal);

router.get("/admin/summary", authorize(UserRole.ADMIN), earningController.getAdminSummary);
router.get("/admin/withdrawals", authorize(UserRole.ADMIN), earningController.listAdminWithdrawals);
router.patch("/admin/withdrawals/:id/approve", authorize(UserRole.ADMIN), earningController.approveWithdrawal);
router.patch("/admin/withdrawals/:id/reject", authorize(UserRole.ADMIN), earningController.rejectWithdrawal);
router.patch("/admin/withdrawals/:id/process", authorize(UserRole.ADMIN), earningController.processWithdrawal);
router.patch("/admin/withdrawals/:id/confirm-paid", authorize(UserRole.ADMIN), earningController.confirmWithdrawalPaid);

export default router;
