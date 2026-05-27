"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_repository_1 = require("../repositories/user.repository");
const store_repository_1 = require("../repositories/store.repository");
const store_model_1 = require("../models/store.model");
const user_model_1 = require("../models/user.model");
const ApiError_1 = require("../utils/ApiError");
const email_1 = require("../utils/email");
class AuthService {
    generateAccessToken(userId, role) {
        return jsonwebtoken_1.default.sign({ id: userId, role }, process.env.JWT_SECRET || "default_secret", {
            expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
        });
    }
    generateRefreshToken(userId, role) {
        return jsonwebtoken_1.default.sign({ id: userId, role, type: "refresh" }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "default_secret", {
            expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
        });
    }
    buildSession(userId, role) {
        return {
            token: this.generateAccessToken(userId, role),
            refreshToken: this.generateRefreshToken(userId, role),
        };
    }
    refreshSession(refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!refreshToken) {
                throw new ApiError_1.ApiError(401, "Refresh token is required");
            }
            let decoded;
            try {
                decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "default_secret");
            }
            catch (_a) {
                throw new ApiError_1.ApiError(401, "Session expired. Please log in again");
            }
            if (decoded.type !== "refresh" || !decoded.id || !decoded.role) {
                throw new ApiError_1.ApiError(401, "Invalid refresh token");
            }
            const user = yield user_repository_1.userRepository.findById(String(decoded.id));
            if (!user) {
                throw new ApiError_1.ApiError(401, "User session is no longer valid");
            }
            if (user.accountStatus === user_model_1.UserAccountStatus.SUSPENDED) {
                throw new ApiError_1.ApiError(403, "This account has been suspended");
            }
            return Object.assign({ user: {
                    id: user._id.toString(),
                    role: user.role,
                } }, this.buildSession(user._id.toString(), user.role));
        });
    }
    hashPassword(password) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield bcryptjs_1.default.hash(password, 10);
        });
    }
    generateSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "") + "-" + Math.random().toString(36).substring(2, 6);
    }
    createVerificationToken() {
        return {
            token: crypto_1.default.randomBytes(32).toString("hex"),
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };
    }
    getVerificationUrl(token) {
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        return `${frontendUrl}/auth/verify-email?token=${token}`;
    }
    sendVerificationEmailSafely(data) {
        (0, email_1.sendVerificationEmail)({
            email: data.email,
            fullName: data.fullName,
            verificationUrl: this.getVerificationUrl(data.token),
        }).catch((error) => {
            console.error("Verification email failed:", error.message);
        });
    }
    sanitizeUser(user) {
        const userResponse = user.toObject ? user.toObject() : Object.assign({}, user);
        delete userResponse.password;
        delete userResponse.emailVerificationToken;
        delete userResponse.emailVerificationExpires;
        return userResponse;
    }
    getCurrentUser(currentUser) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield user_repository_1.userRepository.findById(currentUser.id);
            if (!user) {
                throw new ApiError_1.ApiError(401, "User session is no longer valid");
            }
            if (user.accountStatus === user_model_1.UserAccountStatus.SUSPENDED) {
                throw new ApiError_1.ApiError(403, "This account has been suspended");
            }
            let store = null;
            if (user.role === user_model_1.UserRole.VENDOR) {
                store = yield store_repository_1.storeRepository.findByVendorId(user._id.toString());
            }
            return {
                user: this.sanitizeUser(user),
                store,
            };
        });
    }
    registerBuyer(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const { fullName, email, password, phone } = data;
            const existingUser = yield user_repository_1.userRepository.findByEmail(email);
            if (existingUser) {
                throw new ApiError_1.ApiError(400, "User with this email already exists");
            }
            const hashedPassword = yield this.hashPassword(password);
            const verification = this.createVerificationToken();
            const user = yield user_repository_1.userRepository.create({
                fullName,
                email,
                phone,
                password: hashedPassword,
                role: user_model_1.UserRole.BUYER,
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
        });
    }
    registerVendor(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const { fullName, email, password, phone, storeName, category, address, bankName, accountNumber, cacNumber } = data;
            const existingUser = yield user_repository_1.userRepository.findByEmail(email);
            if (existingUser) {
                throw new ApiError_1.ApiError(400, "User with this email already exists");
            }
            const hashedPassword = yield this.hashPassword(password);
            const verification = this.createVerificationToken();
            // 1. Create User as VENDOR
            const user = yield user_repository_1.userRepository.create({
                fullName,
                email,
                phone,
                password: hashedPassword,
                role: user_model_1.UserRole.VENDOR,
                emailVerificationToken: verification.token,
                emailVerificationExpires: verification.expires,
            });
            // 2. Create associated Store
            const store = yield store_repository_1.storeRepository.create({
                vendorId: user._id,
                storeName,
                slug: this.generateSlug(storeName),
                category,
                address,
                status: store_model_1.StoreStatus.ACTIVE,
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
        });
    }
    login(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const { email, password } = data;
            const user = yield user_repository_1.userRepository.findByEmail(email);
            if (!user || !user.password) {
                throw new ApiError_1.ApiError(401, "Invalid email or password");
            }
            if (!user.isVerified) {
                throw new ApiError_1.ApiError(403, "Please verify your email before logging in");
            }
            if (user.accountStatus === user_model_1.UserAccountStatus.SUSPENDED) {
                throw new ApiError_1.ApiError(403, "This account has been suspended");
            }
            const isPasswordValid = yield bcryptjs_1.default.compare(password, user.password);
            if (!isPasswordValid) {
                throw new ApiError_1.ApiError(401, "Invalid email or password");
            }
            const userId = user._id.toString();
            const session = this.buildSession(userId, user.role);
            const userResponse = this.sanitizeUser(user);
            let store = null;
            if (user.role === user_model_1.UserRole.VENDOR) {
                store = yield store_repository_1.storeRepository.findByVendorId(userId);
            }
            return Object.assign({ user: userResponse, store }, session);
        });
    }
    verifyEmail(token) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!token) {
                throw new ApiError_1.ApiError(400, "Verification token is required");
            }
            const user = yield user_repository_1.userRepository.findByVerificationToken(token);
            if (!user) {
                throw new ApiError_1.ApiError(400, "Invalid or expired verification link");
            }
            user.isVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
            yield user.save();
            const userResponse = this.sanitizeUser(user);
            return { user: userResponse };
        });
    }
}
exports.authService = new AuthService();
