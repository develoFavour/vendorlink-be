import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { userRepository } from "../repositories/user.repository";
import { storeRepository } from "../repositories/store.repository";
import { StoreStatus } from "../models/store.model";
import { UserAccountStatus, UserRole } from "../models/user.model";
import { ApiError } from "../utils/ApiError";
import { sendVerificationEmail } from "../utils/email";

class AuthService {
  private generateAccessToken(userId: string, role: UserRole): string {
    return jwt.sign({ id: userId, role }, process.env.JWT_SECRET || "default_secret", {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
    } as jwt.SignOptions);
  }

  private generateRefreshToken(userId: string, role: UserRole): string {
    return jwt.sign({ id: userId, role, type: "refresh" }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "default_secret", {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
    } as jwt.SignOptions);
  }

  private buildSession(userId: string, role: UserRole) {
    return {
      token: this.generateAccessToken(userId, role),
      refreshToken: this.generateRefreshToken(userId, role),
    };
  }

  async refreshSession(refreshToken: string | null) {
    if (!refreshToken) {
      throw new ApiError(401, "Refresh token is required");
    }

    let decoded: jwt.JwtPayload;

    try {
      decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "default_secret"
      ) as jwt.JwtPayload;
    } catch {
      throw new ApiError(401, "Session expired. Please log in again");
    }

    if (decoded.type !== "refresh" || !decoded.id || !decoded.role) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const user = await userRepository.findById(String(decoded.id));
    if (!user) {
      throw new ApiError(401, "User session is no longer valid");
    }

    if (user.accountStatus === UserAccountStatus.SUSPENDED) {
      throw new ApiError(403, "This account has been suspended");
    }

    return {
      user: {
        id: user._id.toString(),
        role: user.role,
      },
      ...this.buildSession(user._id.toString(), user.role),
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 10);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") + "-" + Math.random().toString(36).substring(2, 6);
  }

  private createVerificationToken() {
    return {
      token: crypto.randomBytes(32).toString("hex"),
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  private getVerificationUrl(token: string): string {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return `${frontendUrl}/auth/verify-email?token=${token}`;
  }

  private sendVerificationEmailSafely(data: {
    email: string;
    fullName: string;
    token: string;
  }) {
    sendVerificationEmail({
      email: data.email,
      fullName: data.fullName,
      verificationUrl: this.getVerificationUrl(data.token),
    }).catch((error) => {
      console.error("Verification email failed:", error.message);
    });
  }

  private sanitizeUser(user: any) {
    const userResponse = user.toObject ? user.toObject() : { ...user };
    delete userResponse.password;
    delete userResponse.emailVerificationToken;
    delete userResponse.emailVerificationExpires;
    return userResponse;
  }

  async getCurrentUser(currentUser: { id: string; role: UserRole }) {
    const user = await userRepository.findById(currentUser.id);

    if (!user) {
      throw new ApiError(401, "User session is no longer valid");
    }

    if (user.accountStatus === UserAccountStatus.SUSPENDED) {
      throw new ApiError(403, "This account has been suspended");
    }

    let store = null;
    if (user.role === UserRole.VENDOR) {
      store = await storeRepository.findByVendorId(user._id.toString());
    }

    return {
      user: this.sanitizeUser(user),
      store,
    };
  }

  async registerBuyer(data: any) {
    const { fullName, email, password, phone } = data;

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new ApiError(400, "User with this email already exists");
    }

    const hashedPassword = await this.hashPassword(password);
    const verification = this.createVerificationToken();

    const user = await userRepository.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: UserRole.BUYER,
      emailVerificationToken: verification.token,
      emailVerificationExpires: verification.expires,
    });

    const userResponse = this.sanitizeUser(user);

    this.sendVerificationEmailSafely({
      email: user.email,
      fullName: user.fullName,
      token: verification.token,
    });

    return { user: userResponse };
  }

  async registerVendor(data: any) {
    const { fullName, email, password, phone, storeName, category, address, bankName, accountNumber, cacNumber } = data;

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new ApiError(400, "User with this email already exists");
    }

    const hashedPassword = await this.hashPassword(password);
    const verification = this.createVerificationToken();

    // 1. Create User as VENDOR
    const user = await userRepository.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: UserRole.VENDOR,
      emailVerificationToken: verification.token,
      emailVerificationExpires: verification.expires,
    });

    // 2. Create associated Store
    const store = await storeRepository.create({
      vendorId: user._id,
      storeName,
      slug: this.generateSlug(storeName),
      category,
      address,
      status: StoreStatus.ACTIVE,
      kyc: {
        bankName,
        accountNumber,
        cacNumber
      }
    });

    const userResponse = this.sanitizeUser(user);

    this.sendVerificationEmailSafely({
      email: user.email,
      fullName: user.fullName,
      token: verification.token,
    });

    return { user: userResponse, store };
  }

  async login(data: any) {
    const { email, password } = data;

    const user = await userRepository.findByEmail(email);
    if (!user || !user.password) {
      throw new ApiError(401, "Invalid email or password");
    }

    if (!user.isVerified) {
      throw new ApiError(403, "Please verify your email before logging in");
    }

    if (user.accountStatus === UserAccountStatus.SUSPENDED) {
      throw new ApiError(403, "This account has been suspended");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    const userId = user._id.toString();
    const session = this.buildSession(userId, user.role);

    const userResponse = this.sanitizeUser(user);

    let store = null;
    if (user.role === UserRole.VENDOR) {
      store = await storeRepository.findByVendorId(userId);
    }

    return { user: userResponse, store, ...session };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new ApiError(400, "Verification token is required");
    }

    const user = await userRepository.findByVerificationToken(token);
    if (!user) {
      throw new ApiError(400, "Invalid or expired verification link");
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    const userResponse = this.sanitizeUser(user);

    return { user: userResponse };
  }
}

export const authService = new AuthService();
