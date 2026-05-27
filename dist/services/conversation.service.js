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
exports.conversationService = void 0;
const mongoose_1 = require("mongoose");
const conversation_model_1 = require("../models/conversation.model");
const message_model_1 = require("../models/message.model");
const product_model_1 = require("../models/product.model");
const user_model_1 = require("../models/user.model");
const product_repository_1 = require("../repositories/product.repository");
const ApiError_1 = require("../utils/ApiError");
const socket_1 = require("../socket");
const toPositiveInteger = (value, fallback, max = 100) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1)
        return fallback;
    return Math.min(parsed, max);
};
const sanitizeBody = (value) => {
    const body = typeof value === "string" ? value.trim() : "";
    if (!body)
        throw new ApiError_1.ApiError(400, "Message cannot be empty");
    if (body.length > 2000)
        throw new ApiError_1.ApiError(400, "Message cannot exceed 2000 characters");
    return body;
};
class ConversationService {
    getConversationForUser(user, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield conversation_model_1.Conversation.findById(conversationId);
            if (!conversation) {
                throw new ApiError_1.ApiError(404, "Conversation not found");
            }
            const isParticipant = conversation.buyerId.toString() === user.id ||
                conversation.sellerId.toString() === user.id ||
                user.role === user_model_1.UserRole.ADMIN;
            if (!isParticipant) {
                throw new ApiError_1.ApiError(403, "You are not allowed to access this conversation");
            }
            return conversation;
        });
    }
    getReceiverId(conversation, user) {
        if (conversation.buyerId.toString() === user.id) {
            return conversation.sellerId;
        }
        if (conversation.sellerId.toString() === user.id) {
            return conversation.buyerId;
        }
        throw new ApiError_1.ApiError(403, "You are not a participant in this conversation");
    }
    startFromProduct(user, productId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (user.role !== user_model_1.UserRole.BUYER && user.role !== user_model_1.UserRole.ADMIN) {
                throw new ApiError_1.ApiError(403, "Only buyers can start product conversations");
            }
            const product = yield product_repository_1.productRepository.findById(productId);
            if (!product || product.status !== product_model_1.ProductStatus.PUBLISHED) {
                throw new ApiError_1.ApiError(404, "Product not found");
            }
            if (product.vendorId.toString() === user.id) {
                throw new ApiError_1.ApiError(400, "You cannot message yourself about your own product");
            }
            const conversation = yield conversation_model_1.Conversation.findOneAndUpdate({
                buyerId: user.id,
                sellerId: product.vendorId,
                productId: product._id,
            }, {
                $setOnInsert: {
                    buyerId: new mongoose_1.Types.ObjectId(user.id),
                    sellerId: product.vendorId,
                    productId: product._id,
                    unreadByBuyer: 0,
                    unreadBySeller: 0,
                },
            }, { upsert: true, returnDocument: "after", setDefaultsOnInsert: true })
                .populate("buyerId", "fullName email")
                .populate("sellerId", "fullName email")
                .populate("productId", "name image price brand category");
            return conversation;
        });
    }
    listConversations(user) {
        return __awaiter(this, void 0, void 0, function* () {
            const filter = user.role === user_model_1.UserRole.VENDOR
                ? { sellerId: user.id }
                : user.role === user_model_1.UserRole.BUYER
                    ? { buyerId: user.id }
                    : {};
            return conversation_model_1.Conversation.find(filter)
                .populate("buyerId", "fullName email")
                .populate("sellerId", "fullName email")
                .populate("productId", "name image price brand category")
                .sort({ lastMessageAt: -1, updatedAt: -1 });
        });
    }
    getMessages(user, conversationId, query) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.getConversationForUser(user, conversationId);
            const page = toPositiveInteger(query.page, 1);
            const limit = toPositiveInteger(query.limit, 30, 80);
            const skip = (page - 1) * limit;
            const [messages, total] = yield Promise.all([
                message_model_1.Message.find({ conversationId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit),
                message_model_1.Message.countDocuments({ conversationId }),
            ]);
            return {
                messages: messages.reverse(),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.max(Math.ceil(total / limit), 1),
                    hasNextPage: page * limit < total,
                    hasPrevPage: page > 1,
                },
            };
        });
    }
    sendMessage(user, conversationId, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield this.getConversationForUser(user, conversationId);
            const body = sanitizeBody(payload.body);
            const receiverId = this.getReceiverId(conversation, user);
            const message = yield message_model_1.Message.create({
                conversationId: conversation._id,
                senderId: new mongoose_1.Types.ObjectId(user.id),
                receiverId,
                body,
            });
            conversation.lastMessage = body;
            conversation.lastMessageAt = new Date();
            if (conversation.buyerId.toString() === user.id) {
                conversation.unreadBySeller += 1;
            }
            else {
                conversation.unreadByBuyer += 1;
            }
            yield conversation.save();
            const populatedConversation = yield conversation_model_1.Conversation.findById(conversation._id)
                .populate("buyerId", "fullName email")
                .populate("sellerId", "fullName email")
                .populate("productId", "name image price brand category");
            (0, socket_1.emitNewMessage)({
                conversationId: conversation._id.toString(),
                receiverId: receiverId.toString(),
                senderId: user.id,
                message,
                conversation: populatedConversation || conversation,
            });
            return message;
        });
    }
    markAsRead(user, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const conversation = yield this.getConversationForUser(user, conversationId);
            yield message_model_1.Message.updateMany({
                conversationId: conversation._id,
                receiverId: user.id,
                readAt: { $exists: false },
            }, { $set: { readAt: new Date() } });
            if (conversation.buyerId.toString() === user.id) {
                conversation.unreadByBuyer = 0;
            }
            if (conversation.sellerId.toString() === user.id) {
                conversation.unreadBySeller = 0;
            }
            yield conversation.save();
            return conversation_model_1.Conversation.findById(conversation._id)
                .populate("buyerId", "fullName email")
                .populate("sellerId", "fullName email")
                .populate("productId", "name image price brand category");
        });
    }
}
exports.conversationService = new ConversationService();
