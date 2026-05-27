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
exports.dashboardController = exports.DashboardController = void 0;
const dashboard_service_1 = require("../services/dashboard.service");
const ApiResponse_1 = require("../utils/ApiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
class DashboardController {
    constructor() {
        this.getAdminOverview = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const overview = yield dashboard_service_1.dashboardService.getAdminOverview(req.user);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, overview, "Admin overview fetched successfully"));
        }));
        this.getSellerOverview = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const overview = yield dashboard_service_1.dashboardService.getSellerOverview(req.user);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, overview, "Seller overview fetched successfully"));
        }));
    }
}
exports.DashboardController = DashboardController;
exports.dashboardController = new DashboardController();
