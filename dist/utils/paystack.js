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
exports.paystack = void 0;
const ApiError_1 = require("./ApiError");
const PAYSTACK_BASE_URL = "https://api.paystack.co";
const getSecretKey = () => {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
        throw new ApiError_1.ApiError(500, "Paystack secret key is not configured");
    }
    return secretKey;
};
const requestPaystack = (path, init) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield fetch(`${PAYSTACK_BASE_URL}${path}`, Object.assign(Object.assign({}, init), { headers: Object.assign({ Authorization: `Bearer ${getSecretKey()}`, "Content-Type": "application/json" }, ((init === null || init === void 0 ? void 0 : init.headers) || {})) }));
    const result = (yield response.json());
    if (!response.ok || !result.status) {
        throw new ApiError_1.ApiError(response.status || 502, result.message || "Paystack request failed");
    }
    return result.data;
});
exports.paystack = {
    initializeTransaction: (payload) => requestPaystack("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
            email: payload.email,
            amount: payload.amount,
            reference: payload.reference,
            callback_url: payload.callbackUrl,
            metadata: payload.metadata,
        }),
    }),
    verifyTransaction: (reference) => requestPaystack(`/transaction/verify/${encodeURIComponent(reference)}`),
    createTransferRecipient: (payload) => requestPaystack("/transferrecipient", {
        method: "POST",
        body: JSON.stringify({
            type: "nuban",
            name: payload.name,
            account_number: payload.accountNumber,
            bank_code: payload.bankCode,
            currency: "NGN",
        }),
    }),
    initiateTransfer: (payload) => requestPaystack("/transfer", {
        method: "POST",
        body: JSON.stringify({
            source: "balance",
            amount: payload.amount,
            recipient: payload.recipient,
            reason: payload.reason,
            reference: payload.reference,
        }),
    }),
};
