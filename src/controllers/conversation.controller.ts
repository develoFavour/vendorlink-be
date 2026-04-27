import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { conversationService } from "../services/conversation.service";
import { ApiResponse } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export class ConversationController {
  private getParamId(req: AuthenticatedRequest, name: string): string {
    const id = req.params[name];
    return Array.isArray(id) ? id[0] : id;
  }

  public startFromProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const conversation = await conversationService.startFromProduct(req.user!, req.body.productId);
    return res.status(201).json(new ApiResponse(201, conversation, "Conversation ready"));
  });

  public getConversations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const conversations = await conversationService.listConversations(req.user!);
    return res.status(200).json(new ApiResponse(200, conversations, "Conversations fetched successfully"));
  });

  public getMessages = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const result = await conversationService.getMessages(req.user!, this.getParamId(req, "id"), req.query);
    return res.status(200).json(new ApiResponse(200, result, "Messages fetched successfully"));
  });

  public sendMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const message = await conversationService.sendMessage(req.user!, this.getParamId(req, "id"), req.body);
    return res.status(201).json(new ApiResponse(201, message, "Message sent successfully"));
  });

  public markAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const conversation = await conversationService.markAsRead(req.user!, this.getParamId(req, "id"));
    return res.status(200).json(new ApiResponse(200, conversation, "Conversation marked as read"));
  });
}

export const conversationController = new ConversationController();
