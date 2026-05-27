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
exports.conversationController = exports.ConversationController = void 0;
const conversation_service_1 = require("../services/conversation.service");
const ApiResponse_1 = require("../utils/ApiResponse");
const asyncHandler_1 = require("../utils/asyncHandler");
class ConversationController {
    constructor() {
        this.startFromProduct = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const conversation = yield conversation_service_1.conversationService.startFromProduct(req.user, req.body.productId);
            return res.status(201).json(new ApiResponse_1.ApiResponse(201, conversation, "Conversation ready"));
        }));
        this.getConversations = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const conversations = yield conversation_service_1.conversationService.listConversations(req.user);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, conversations, "Conversations fetched successfully"));
        }));
        this.getMessages = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const result = yield conversation_service_1.conversationService.getMessages(req.user, this.getParamId(req, "id"), req.query);
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, result, "Messages fetched successfully"));
        }));
        this.sendMessage = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const message = yield conversation_service_1.conversationService.sendMessage(req.user, this.getParamId(req, "id"), req.body);
            return res.status(201).json(new ApiResponse_1.ApiResponse(201, message, "Message sent successfully"));
        }));
        this.markAsRead = (0, asyncHandler_1.asyncHandler)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const conversation = yield conversation_service_1.conversationService.markAsRead(req.user, this.getParamId(req, "id"));
            return res.status(200).json(new ApiResponse_1.ApiResponse(200, conversation, "Conversation marked as read"));
        }));
    }
    getParamId(req, name) {
        const id = req.params[name];
        return Array.isArray(id) ? id[0] : id;
    }
}
exports.ConversationController = ConversationController;
exports.conversationController = new ConversationController();
