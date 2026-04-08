import ChatThread from "../models/ChatThread.js";
import User from "../models/User.js";
import Provider from "../models/Provider.js";
import path from "path";

// ── Helper: resolve names ──────────────────────────────────────────────────
const resolvePartyNames = async (userId, providerId) => {
  const [user, provider] = await Promise.all([
    User.findById(userId).select("name"),
    Provider.findById(providerId).select("name"),
  ]);
  return {
    userName: user?.name || "User",
    providerName: provider?.name || "Provider",
  };
};

// ── GET /api/chat/threads ─────────────────────────────────────────────────
// Returns all threads for the authenticated user or provider
export const getThreads = async (req, res) => {
  try {
    const { id, role } = req.user;
    const filter = role === "provider" ? { providerId: id } : { userId: id };

    const threads = await ChatThread.find(filter)
      .select("-messages")
      .sort({ lastMessageAt: -1 });

    res.json({ success: true, data: threads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/chat/threads ────────────────────────────────────────────────
// Create or retrieve a thread (idempotent per booking/service pair)
export const createThread = async (req, res) => {
  try {
    const { id: requesterId, role } = req.user;
    const { providerId, userId, bookingId, serviceId, serviceName } = req.body;

    // Determine actual userId / providerId based on who is calling
    const resolvedUserId = role === "user" ? requesterId : userId;
    const resolvedProviderId = role === "provider" ? requesterId : providerId;

    if (!resolvedUserId || !resolvedProviderId) {
      return res.status(400).json({ success: false, message: "userId and providerId are required." });
    }

    // Check for existing thread with same pairing + optional booking
    const query = { userId: resolvedUserId, providerId: resolvedProviderId };
    if (bookingId) query.bookingId = bookingId;
    if (serviceId && !bookingId) query.serviceId = serviceId;

    let thread = await ChatThread.findOne(query).select("-messages");

    if (!thread) {
      const names = await resolvePartyNames(resolvedUserId, resolvedProviderId);
      thread = await ChatThread.create({
        userId: resolvedUserId,
        providerId: resolvedProviderId,
        bookingId: bookingId || null,
        serviceId: serviceId || null,
        serviceName: serviceName || "General Inquiry",
        userName: names.userName,
        providerName: names.providerName,
      });
    }

    res.status(201).json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/chat/threads/:threadId ──────────────────────────────────────
// Get a single thread including messages
export const getThread = async (req, res) => {
  try {
    const { id, role } = req.user;
    const thread = await ChatThread.findById(req.params.threadId);

    if (!thread) {
      return res.status(404).json({ success: false, message: "Thread not found." });
    }

    // Ownership check
    const ownerId = (role === "provider" ? thread.providerId : thread.userId).toString();
    if (ownerId !== id) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    res.json({ success: true, data: thread });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/chat/threads/:threadId/messages ─────────────────────────────
// Send a text message
export const sendMessage = async (req, res) => {
  try {
    const { id, role } = req.user;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: "Message content is required." });
    }

    const thread = await ChatThread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: "Thread not found." });
    }

    const ownerId = (role === "provider" ? thread.providerId : thread.userId).toString();
    if (ownerId !== id) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const senderName = role === "provider" ? thread.providerName : thread.userName;

    const message = {
      senderId: id,
      senderRole: role,
      senderName,
      content: content.trim(),
      fileUrl: null,
      fileType: null,
      fileName: null,
    };

    thread.messages.push(message);
    thread.lastMessage = content.trim().substring(0, 100);
    thread.lastMessageAt = new Date();

    if (role === "user") {
      thread.unreadCountProvider += 1;
    } else {
      thread.unreadCountUser += 1;
    }

    await thread.save();

    const newMsg = thread.messages[thread.messages.length - 1];
    res.status(201).json({ success: true, data: newMsg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/chat/threads/:threadId/upload ───────────────────────────────
// Send a file or image message
export const sendFileMessage = async (req, res) => {
  try {
    const { id, role } = req.user;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    const thread = await ChatThread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: "Thread not found." });
    }

    const ownerId = (role === "provider" ? thread.providerId : thread.userId).toString();
    if (ownerId !== id) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const fileType = imageExts.includes(ext) ? "image" : "file";

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    const senderName = role === "provider" ? thread.providerName : thread.userName;

    const message = {
      senderId: id,
      senderRole: role,
      senderName,
      content: "",
      fileUrl,
      fileType,
      fileName: req.file.originalname,
    };

    thread.messages.push(message);
    thread.lastMessage = fileType === "image" ? "📷 Image" : `📎 ${req.file.originalname}`;
    thread.lastMessageAt = new Date();

    if (role === "user") {
      thread.unreadCountProvider += 1;
    } else {
      thread.unreadCountUser += 1;
    }

    await thread.save();

    const newMsg = thread.messages[thread.messages.length - 1];
    res.status(201).json({ success: true, data: newMsg });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/chat/threads/:threadId/read ────────────────────────────────
// Mark all messages in thread as read for the current user/provider
export const markRead = async (req, res) => {
  try {
    const { id, role } = req.user;

    const thread = await ChatThread.findById(req.params.threadId);
    if (!thread) {
      return res.status(404).json({ success: false, message: "Thread not found." });
    }

    const ownerId = (role === "provider" ? thread.providerId : thread.userId).toString();
    if (ownerId !== id) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    // Mark messages sent by the other party as read
    thread.messages.forEach((msg) => {
      if (msg.senderRole !== role) {
        msg.isRead = true;
      }
    });

    if (role === "user") {
      thread.unreadCountUser = 0;
    } else {
      thread.unreadCountProvider = 0;
    }

    await thread.save();
    res.json({ success: true, message: "Messages marked as read." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
