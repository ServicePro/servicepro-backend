import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { uploadChatFile } from "../middleware/chatUploadMiddleware.js";
import {
  getThreads,
  createThread,
  getThread,
  sendMessage,
  sendFileMessage,
  markRead,
} from "../controllers/chatController.js";

const router = express.Router();

// All chat routes require authentication
router.use(protect);

router.get("/threads", getThreads);
router.post("/threads", createThread);
router.get("/threads/:threadId", getThread);
router.post("/threads/:threadId/messages", sendMessage);
router.post("/threads/:threadId/upload", uploadChatFile, sendFileMessage);
router.patch("/threads/:threadId/read", markRead);

export default router;
