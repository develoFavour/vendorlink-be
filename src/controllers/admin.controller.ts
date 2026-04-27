import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { StoreStatus } from "../models/store.model";
import { UserAccountStatus } from "../models/user.model";
import { adminService } from "../services/admin.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

class AdminController {
  private getParamId(req: AuthenticatedRequest, key: string) {
    const value = req.params[key];
    return Array.isArray(value) ? value[0] : value;
  }

  public listUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.listUsers(req.user!, req.query);
    return res.status(200).json(new ApiResponse(200, result, "Users fetched successfully"));
  });

  public updateUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await adminService.updateUserStatus(
      req.user!,
      this.getParamId(req, "userId"),
      req.body.status as UserAccountStatus
    );
    return res.status(200).json(new ApiResponse(200, user, "User status updated successfully"));
  });

  public listVendors = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await adminService.listVendors(req.user!, req.query);
    return res.status(200).json(new ApiResponse(200, result, "Vendors fetched successfully"));
  });

  public updateVendorStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const vendor = await adminService.updateVendorStatus(
      req.user!,
      this.getParamId(req, "storeId"),
      req.body.status as StoreStatus
    );
    return res.status(200).json(new ApiResponse(200, vendor, "Vendor status updated successfully"));
  });
}

export const adminController = new AdminController();
