import { Types } from "mongoose";
import { Conversation, IConversation } from "../models/conversation.model";
import { Message } from "../models/message.model";
import { ProductStatus } from "../models/product.model";
import { UserRole } from "../models/user.model";
import { productRepository } from "../repositories/product.repository";
import { ApiError } from "../utils/ApiError";
import { emitNewMessage } from "../socket";

type CurrentUser = {
  id: string;
  role: UserRole;
};

type MessagePayload = {
  body?: string;
};

const toPositiveInteger = (value: unknown, fallback: number, max = 100) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const sanitizeBody = (value?: string) => {
  const body = typeof value === "string" ? value.trim() : "";
  if (!body) throw new ApiError(400, "Message cannot be empty");
  if (body.length > 2000) throw new ApiError(400, "Message cannot exceed 2000 characters");
  return body;
};

class ConversationService {
  private async getConversationForUser(user: CurrentUser, conversationId: string) {
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      throw new ApiError(404, "Conversation not found");
    }

    const isParticipant =
      conversation.buyerId.toString() === user.id ||
      conversation.sellerId.toString() === user.id ||
      user.role === UserRole.ADMIN;

    if (!isParticipant) {
      throw new ApiError(403, "You are not allowed to access this conversation");
    }

    return conversation;
  }

  private getReceiverId(conversation: IConversation, user: CurrentUser) {
    if (conversation.buyerId.toString() === user.id) {
      return conversation.sellerId;
    }

    if (conversation.sellerId.toString() === user.id) {
      return conversation.buyerId;
    }

    throw new ApiError(403, "You are not a participant in this conversation");
  }

  async startFromProduct(user: CurrentUser, productId: string) {
    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN) {
      throw new ApiError(403, "Only buyers can start product conversations");
    }

    const product = await productRepository.findById(productId);

    if (!product || product.status !== ProductStatus.PUBLISHED) {
      throw new ApiError(404, "Product not found");
    }

    if (product.vendorId.toString() === user.id) {
      throw new ApiError(400, "You cannot message yourself about your own product");
    }

    const conversation = await Conversation.findOneAndUpdate(
      {
        buyerId: user.id,
        sellerId: product.vendorId,
        productId: product._id,
      },
      {
        $setOnInsert: {
          buyerId: new Types.ObjectId(user.id),
          sellerId: product.vendorId,
          productId: product._id,
          unreadByBuyer: 0,
          unreadBySeller: 0,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    )
      .populate("buyerId", "fullName email")
      .populate("sellerId", "fullName email")
      .populate("productId", "name image price brand category");

    return conversation;
  }

  async listConversations(user: CurrentUser) {
    const filter =
      user.role === UserRole.VENDOR
        ? { sellerId: user.id }
        : user.role === UserRole.BUYER
          ? { buyerId: user.id }
          : {};

    return Conversation.find(filter)
      .populate("buyerId", "fullName email")
      .populate("sellerId", "fullName email")
      .populate("productId", "name image price brand category")
      .sort({ lastMessageAt: -1, updatedAt: -1 });
  }

  async getMessages(user: CurrentUser, conversationId: string, query: { page?: unknown; limit?: unknown }) {
    await this.getConversationForUser(user, conversationId);
    const page = toPositiveInteger(query.page, 1);
    const limit = toPositiveInteger(query.limit, 30, 80);
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments({ conversationId }),
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
  }

  async sendMessage(user: CurrentUser, conversationId: string, payload: MessagePayload) {
    const conversation = await this.getConversationForUser(user, conversationId);
    const body = sanitizeBody(payload.body);
    const receiverId = this.getReceiverId(conversation, user);

    const message = await Message.create({
      conversationId: conversation._id,
      senderId: new Types.ObjectId(user.id),
      receiverId,
      body,
    });

    conversation.lastMessage = body;
    conversation.lastMessageAt = new Date();

    if (conversation.buyerId.toString() === user.id) {
      conversation.unreadBySeller += 1;
    } else {
      conversation.unreadByBuyer += 1;
    }

    await conversation.save();
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("buyerId", "fullName email")
      .populate("sellerId", "fullName email")
      .populate("productId", "name image price brand category");

    emitNewMessage({
      conversationId: conversation._id.toString(),
      receiverId: receiverId.toString(),
      senderId: user.id,
      message,
      conversation: populatedConversation || conversation,
    });

    return message;
  }

  async markAsRead(user: CurrentUser, conversationId: string) {
    const conversation = await this.getConversationForUser(user, conversationId);

    await Message.updateMany(
      {
        conversationId: conversation._id,
        receiverId: user.id,
        readAt: { $exists: false },
      },
      { $set: { readAt: new Date() } }
    );

    if (conversation.buyerId.toString() === user.id) {
      conversation.unreadByBuyer = 0;
    }

    if (conversation.sellerId.toString() === user.id) {
      conversation.unreadBySeller = 0;
    }

    await conversation.save();
    return Conversation.findById(conversation._id)
      .populate("buyerId", "fullName email")
      .populate("sellerId", "fullName email")
      .populate("productId", "name image price brand category");
  }
}

export const conversationService = new ConversationService();
