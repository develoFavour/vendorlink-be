import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../models/user.model";
import { userRepository } from "../repositories/user.repository";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
  };
}

type JwtPayload = {
  id: string;
  role: UserRole;
};

const parseCookie = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  if (!target) return null;

  return decodeURIComponent(target.slice(name.length + 1));
};

export const protect = asyncHandler(
  async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const cookieToken = parseCookie(req.headers.cookie, "auth_token");
    const bearerToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;
    const token = cookieToken || bearerToken;

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as JwtPayload;
    } catch {
      throw new ApiError(401, "Session expired. Please refresh your session");
    }

    const user = await userRepository.findById(decoded.id);

    if (!user) {
      throw new ApiError(401, "User session is no longer valid");
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
    };

    next();
  }
);

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ApiError(403, "You are not allowed to access this resource");
    }

    next();
  };
};
