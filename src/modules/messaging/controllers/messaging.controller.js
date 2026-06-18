const messagingService = require("../services/messaging.service");

const postMessageRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, message } = req.body;

    if (!receiverId) {
      return res.status(400).json({ error: "receiverId is required." });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message content is required." });
    }

    const request = await messagingService.sendMessageRequest(senderId, receiverId, message);
    res.status(201).json(request);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const patchMessageRequest = async (req, res) => {
  try {
    const receiverId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "status is required." });
    }

    const result = await messagingService.respondToMessageRequest(id, receiverId, status);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getMessageRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { direction } = req.query; // "sent" or "received" (default: "received")

    const requests = await messagingService.listMessageRequests(userId, direction);
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const postDirectMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { chatId } = req.params;
    const { content, parentId, voiceUrl, voiceDuration } = req.body;

    if (!content && !voiceUrl) {
      return res.status(400).json({ error: "Message content or voiceUrl is required." });
    }

    const message = await messagingService.sendDirectMessage(senderId, chatId, {
      content,
      parentId,
      voiceUrl,
      voiceDuration,
    });
    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getChats = async (req, res) => {
  try {
    const userId = req.user.id;
    const chats = await messagingService.listChats(userId);
    res.status(200).json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getChatMessagesHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { limit, beforeId } = req.query;

    const parsedLimit = limit ? parseInt(limit, 10) : 50;

    const messages = await messagingService.getChatMessages(userId, chatId, parsedLimit, beforeId);
    res.status(200).json(messages);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const patchChatRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    const result = await messagingService.markChatAsRead(userId, chatId);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const postMessageReaction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required." });
    }

    const result = await messagingService.toggleMessageReaction(userId, messageId, emoji);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const patchChatArchive = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;
    const { isArchived } = req.body;

    if (isArchived === undefined) {
      return res.status(400).json({ error: "isArchived boolean value is required." });
    }

    const chat = await messagingService.archiveChat(userId, chatId, isArchived);
    res.status(200).json(chat);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteChatHandler = async (req, res) => {
  try {
    const userId = req.user.id;
    const { chatId } = req.params;

    await messagingService.deleteChat(userId, chatId);
    res.status(200).json({ message: "Conversation deleted successfully." });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  postMessageRequest,
  patchMessageRequest,
  getMessageRequests,
  postDirectMessage,
  getChats,
  getChatMessagesHandler,
  patchChatRead,
  postMessageReaction,
  patchChatArchive,
  deleteChatHandler,
};
