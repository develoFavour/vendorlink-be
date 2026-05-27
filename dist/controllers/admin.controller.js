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
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = void 0;
const admin_service_1 = require("../services/admin.service");
const ApiResponse_1 = require("../utils/ApiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
class AdminController {
    constructor() {
        this.listUsers = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield admin_service_1.adminService.listUsers(req.user, req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Users fetched successfully"));
        }));
        this.updateUserStatus = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const user = yield admin_service_1.adminService.updateUserStatus(req.user, this.getParamId(req, "userId"), req.body.status);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, user, "User status updated successfully"));
        }));
        this.listVendors = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield admin_service_1.adminService.listVendors(req.user, req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Vendors fetched successfully"));
        }));
        this.updateVendorStatus = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const vendor = yield admin_service_1.adminService.updateVendorStatus(req.user, this.getParamId(req, "storeId"), req.body.status);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, vendor, "Vendor status updated successfully"));
        }));
    }
    getParamId(req, key) {
        const value = req.params[key];
        return Array.isArray(value) ? value[0] : value;
    }
}
exports.adminController = new AdminController();
