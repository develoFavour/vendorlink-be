import { Router } from "express";
import { conversationController } from "../controllers/conversation.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.use(protect);

router.post("/start", conversationController.startFromProduct);
router.get("/", conversationController.getConversations);
router.get("/:id/messages", conversationController.getMessages);
router.post("/:id/messages", conversationController.sendMessage);
router.patch("/:id/read", conversationController.markAsRead);

export default router;
