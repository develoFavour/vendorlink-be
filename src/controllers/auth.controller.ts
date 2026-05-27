import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  path: "/",
};

const accessCookieOptions = {
  ...cookieOptions,
  maxAge: 15 * 60 * 1000,
};

const refreshCookieOptions = {
  ...cookieOptions,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const roleCookieOptions = {
  ...cookieOptions,
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

const parseCookie = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  if (!target) return null;

  return decodeURIComponent(target.slice(name.length + 1));
};

const setAuthCookies = (res: Response, data: any) => {
  res.cookie("auth_token", data.token, accessCookieOptions);
  res.cookie("refresh_token", data.refreshToken, refreshCookieOptions);
  res.cookie("auth_role", data.user.role, roleCookieOptions);
};

const withoutToken = (data: any) => {
  const { token, refreshToken, ...responseData } = data;
  return responseData;
};

const clearAuthCookies = (res: Response) => {
  res.clearCookie("auth_token", { ...cookieOptions, maxAge: undefined });
  res.clearCookie("refresh_token", { ...cookieOptions, maxAge: undefined });
  res.clearCookie("auth_role", { ...cookieOptions, maxAge: undefined });
};

export class AuthController {
  
  public registerBuyer = asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.registerBuyer(req.body);
    return res.status(201).json(new ApiResponse(201, data, "Buyer registered successfully. Please verify your email."));
  });

  public registerVendor = asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.registerVendor(req.body);
    return res.status(201).json(new ApiResponse(201, data, "Vendor registered successfully. Please verify your email."));
  });

  public login = asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.login(req.body);
    setAuthCookies(res, data);
    return res.status(200).json(new ApiResponse(200, withoutToken(data), "Login successful"));
  });

  public me = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await authService.getCurrentUser(req.user!);
    return res.status(200).json(new ApiResponse(200, data, "Authenticated session"));
  });

  public refresh = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = parseCookie(req.headers.cookie, "refresh_token");
    const data = await authService.refreshSession(refreshToken);
    setAuthCookies(res, data);
    return res.status(200).json(new ApiResponse(200, withoutToken(data), "Session refreshed"));
  });

  public logout = asyncHandler(async (_req: Request, res: Response) => {
    clearAuthCookies(res);
    return res.status(200).json(new ApiResponse(200, null, "Logout successful"));
  });

  public verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.verifyEmail(req.body.token);
    return res.status(200).json(new ApiResponse(200, data, "Email verified successfully"));
  });
}

export const authController = new AuthController();
