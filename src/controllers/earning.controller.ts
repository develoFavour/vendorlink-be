import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { earningService } from "../services/earning.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export class EarningController {
  private getParamId(req: AuthenticatedRequest): string {
    const id = req.params.id;
    return Array.isArray(id) ? id[0] : id;
  }

  public getSellerOverview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await earningService.getSellerOverview(req.user!);
    return res.status(200).json(new ApiResponse(200, result, "Seller earnings fetched successfully"));
  });

  public listSellerEarnings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await earningService.listSellerEarnings(req.user!, req.query);
    return res.status(200).json(new ApiResponse(200, result, "Earnings fetched successfully"));
  });

  public requestWithdrawal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const withdrawal = await earningService.requestWithdrawal(req.user!, req.body);
    return res.status(201).json(new ApiResponse(201, withdrawal, "Withdrawal request submitted successfully"));
  });

  public getAdminSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const summary = await earningService.getAdminSummary(req.user!);
    return res.status(200).json(new ApiResponse(200, summary, "Admin earnings summary fetched successfully"));
  });

  public listAdminWithdrawals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await earningService.listAdminWithdrawals(req.user!, req.query);
    return res.status(200).json(new ApiResponse(200, result, "Withdrawals fetched successfully"));
  });

  public approveWithdrawal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const withdrawal = await earningService.approveWithdrawal(req.user!, this.getParamId(req), req.body);
    return res.status(200).json(new ApiResponse(200, withdrawal, "Withdrawal approved successfully"));
  });

  public rejectWithdrawal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const withdrawal = await earningService.rejectWithdrawal(req.user!, this.getParamId(req), req.body);
    return res.status(200).json(new ApiResponse(200, withdrawal, "Withdrawal rejected successfully"));
  });

  public processWithdrawal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const withdrawal = await earningService.processWithdrawal(req.user!, this.getParamId(req), req.body);
    return res.status(200).json(new ApiResponse(200, withdrawal, "Withdrawal processing started"));
  });

  public confirmWithdrawalPaid = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const withdrawal = await earningService.confirmWithdrawalPaid(req.user!, this.getParamId(req), req.body);
    return res.status(200).json(new ApiResponse(200, withdrawal, "Withdrawal marked as paid"));
  });
}

export const earningController = new EarningController();
