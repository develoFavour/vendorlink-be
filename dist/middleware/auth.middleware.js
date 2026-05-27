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
exports.authorize = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_repository_1 = require("../repositories/user.repository");
const ApiError_1 = require("../utils/ApiError");
const asyncHandler_1 = require("../utils/asyncHandler");
const parseCookie = (cookieHeader, name) => {
    if (!cookieHeader)
        return null;
    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
    if (!target)
        return null;
    return decodeURIComponent(target.slice(name.length + 1));
};
exports.protect = (0, asyncHandler_1.asyncHandler)((req, _res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const cookieToken = parseCookie(req.headers.cookie, "auth_token");
    const bearerToken = ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.startsWith("Bearer "))
        ? req.headers.authorization.split(" ")[1]
        : null;
    const token = cookieToken || bearerToken;
    if (!token) {
        throw new ApiError_1.ApiError(401, "Authentication required");
    }
    let decoded;
    try {
        decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "default_secret");
    }
    catch (_b) {
        throw new ApiError_1.ApiError(401, "Session expired. Please refresh your session");
    }
    const user = yield user_repository_1.userRepository.findById(decoded.id);
    if (!user) {
        throw new ApiError_1.ApiError(401, "User session is no longer valid");
    }
    req.user = {
        id: user._id.toString(),
        role: user.role,
    };
    next();
}));
const authorize = (...roles) => {
    return (req, _res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            throw new ApiError_1.ApiError(403, "You are not allowed to access this resource");
        }
        next();
    };
};
exports.authorize = authorize;
