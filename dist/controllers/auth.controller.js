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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const asyncHandler_1 = require("../utils/asyncHandler");
const ApiResponse_1 = require("../utils/ApiResponse");
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
};
const accessCookieOptions = Object.assign(Object.assign({}, cookieOptions), { maxAge: 15 * 60 * 1000 });
const refreshCookieOptions = Object.assign(Object.assign({}, cookieOptions), { maxAge: 30 * 24 * 60 * 60 * 1000 });
const roleCookieOptions = Object.assign(Object.assign({}, cookieOptions), { maxAge: 30 * 24 * 60 * 60 * 1000 });
const parseCookie = (cookieHeader, name) => {
    if (!cookieHeader)
        return null;
    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
    if (!target)
        return null;
    return decodeURIComponent(target.slice(name.length + 1));
};
const setAuthCookies = (res, data) => {
    res.cookie("auth_token", data.token, accessCookieOptions);
    res.cookie("refresh_token", data.refreshToken, refreshCookieOptions);
    res.cookie("auth_role", data.user.role, roleCookieOptions);
};
const withoutToken = (data) => {
    const { token, refreshToken } = data, responseData = __rest(data, ["token", "refreshToken"]);
    return responseData;
};
const clearAuthCookies = (res) => {
    res.clearCookie("auth_token", Object.assign(Object.assign({}, cookieOptions), { maxAge: undefined }));
    res.clearCookie("refresh_token", Object.assign(Object.assign({}, cookieOptions), { maxAge: undefined }));
    res.clearCookie("auth_role", Object.assign(Object.assign({}, cookieOptions), { maxAge: undefined }));
};
class AuthController {
    constructor() {
        this.registerBuyer = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const data = yield auth_service_1.authService.registerBuyer(req.body);
            return res.status(201).json(new ApiResponse_1.ApiResponse(201, data, "Buyer registered successfully. Please verify your email."));
        }));
        this.registerVendor = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const data = yield auth_service_1.authService.registerVendor(req.body);
            return res.status(201).json(new ApiResponse_1.ApiResponse(201, data, "Vendor registered successfully. Please verify your email."));
        }));
        this.login = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const data = yield auth_service_1.authService.login(req.body);
            setAuthCookies(res, data);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, withoutToken(data), "Login successful"));
        }));
        this.me = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const data = yield auth_service_1.authService.getCurrentUser(req.user);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, data, "Authenticated session"));
        }));
        this.refresh = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const refreshToken = parseCookie(req.headers.cookie, "refresh_token");
            const data = yield auth_service_1.authService.refreshSession(refreshToken);
            setAuthCookies(res, data);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, withoutToken(data), "Session refreshed"));
        }));
        this.logout = (0, asyncHandler_1.asyncHandler)((_req, res) => __awaiter(this, void 0, void 0, function* () {
            clearAuthCookies(res);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, null, "Logout successful"));
        }));
        this.verifyEmail = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const data = yield auth_service_1.authService.verifyEmail(req.body.token);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, data, "Email verified successfully"));
        }));
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
