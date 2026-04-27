import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { dashboardService } from "../services/dashboard.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export class DashboardController {
  public getAdminOverview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const overview = await dashboardService.getAdminOverview(req.user!);
    return res.status(200).json(new ApiResponse(200, overview, "Admin overview fetched successfully"));
  });

  public getSellerOverview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const overview = await dashboardService.getSellerOverview(req.user!);
    return res.status(200).json(new ApiResponse(200, overview, "Seller overview fetched successfully"));
  });
}

export const dashboardController = new DashboardController();
