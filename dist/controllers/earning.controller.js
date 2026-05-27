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
exports.earningController = exports.EarningController = void 0;
const earning_service_1 = require("../services/earning.service");
const ApiResponse_1 = require("../utils/ApiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
class EarningController {
    constructor() {
        this.getSellerOverview = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield earning_service_1.earningService.getSellerOverview(req.user);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Seller earnings fetched successfully"));
        }));
        this.listSellerEarnings = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield earning_service_1.earningService.listSellerEarnings(req.user, req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Earnings fetched successfully"));
        }));
        this.requestWithdrawal = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const withdrawal = yield earning_service_1.earningService.requestWithdrawal(req.user, req.body);
            return res.status(201).json(new ApiResponse_1.ApiResponse(201, withdrawal, "Withdrawal request submitted successfully"));
        }));
        this.getAdminSummary = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const summary = yield earning_service_1.earningService.getAdminSummary(req.user);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, summary, "Admin earnings summary fetched successfully"));
        }));
        this.listAdminWithdrawals = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield earning_service_1.earningService.listAdminWithdrawals(req.user, req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Withdrawals fetched successfully"));
        }));
        this.approveWithdrawal = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const withdrawal = yield earning_service_1.earningService.approveWithdrawal(req.user, this.getParamId(req), req.body);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, withdrawal, "Withdrawal approved successfully"));
        }));
        this.rejectWithdrawal = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const withdrawal = yield earning_service_1.earningService.rejectWithdrawal(req.user, this.getParamId(req), req.body);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, withdrawal, "Withdrawal rejected successfully"));
        }));
        this.processWithdrawal = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const withdrawal = yield earning_service_1.earningService.processWithdrawal(req.user, this.getParamId(req), req.body);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, withdrawal, "Withdrawal processing started"));
        }));
        this.confirmWithdrawalPaid = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const withdrawal = yield earning_service_1.earningService.confirmWithdrawalPaid(req.user, this.getParamId(req), req.body);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, withdrawal, "Withdrawal marked as paid"));
        }));
    }
    getParamId(req) {
        const id = req.params.id;
        return Array.isArray(id) ? id[0] : id;
    }
}
exports.EarningController = EarningController;
exports.earningController = new EarningController();
