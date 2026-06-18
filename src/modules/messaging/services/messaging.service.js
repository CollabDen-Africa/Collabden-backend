const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");

/**
 * Send a message request to an unconnected user
 */
const sendMessageRequest = async (senderId, receiverId, initialMessage) => {
  if (senderId === receiverId) {
    throw new Error("You cannot send a message request to yourself.");
  }

  if (!initialMessage || !initialMessage.trim()) {
    throw new Error("Initial message content is required.");
  }

  // 1. Verify receiver exists
  const receiver = await prisma.userProfile.findUnique({
    where: { id: receiverId },
  });
  if (!receiver) {
    throw new Error("Recipient user not found.");
  }

  // 2. Verify they are not already connected
  const areConnected = await prisma.userConnection.findFirst({
    where: {
      OR: [
        { senderId, receiverId, status: "ACCEPTED" },
        { senderId: receiverId, receiverId: senderId, status: "ACCEPTED" },
      ],
    },
  });

  if (areConnected) {
    throw new Error("You are already connected with this user. Start a chat directly instead.");
  }

  // 3. Check if there is already a pending message request
  const existingRequest = await prisma.messageRequest.findFirst({
    where: {
      senderId,
      receiverId,
      status: "PENDING",
    },
  });

  if (existingRequest) {
    throw new Error("A message request is already pending.");
  }

  // 4. Create the request
  const request = await prisma.messageRequest.create({
    data: {
      senderId,
      receiverId,
      message: initialMessage,
      status: "PENDING",
    },
    include: {
      sender: {
        select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
      },
    },
  });

  // 5. Publish Event
  const senderName = request.sender.displayName || `${request.sender.firstName} ${request.sender.lastName}`.trim() || request.sender.email;
  await publishEvent(EVENT_TYPES.MESSAGE_REQUEST_SENT, {
    request,
    senderName,
  });

  return request;
};

/**
 * Accept or decline a message request.
 * If accepted, auto-creates the direct chat and the first message.
 */
const respondToMessageRequest = async (requestId, receiverId, status) => {
  const request = await prisma.messageRequest.findUnique({
    where: { id: requestId },
    include: {
      sender: {
        select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
      },
      receiver: {
        select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
      },
    },
  });

  if (!request) {
    throw new Error("Message request not found.");
  }

  if (request.receiverId !== receiverId) {
    throw new Error("Unauthorized to respond to this message request.");
  }

  if (request.status !== "PENDING") {
    throw new Error(`This request has already been ${request.status.toLowerCase()}.`);
  }

  if (!["ACCEPTED", "DECLINED"].includes(status)) {
    throw new Error("Invalid status. Must be ACCEPTED or DECLINED.");
  }

  // Update request status
  const updatedRequest = await prisma.messageRequest.update({
    where: { id: requestId },
    data: { status },
  });

  let chatId = null;

  if (status === "ACCEPTED") {
    // Determine user1 and user2 sorted lexically to prevent duplicates and maintain unique constraint
    const [user1Id, user2Id] = [request.senderId, request.receiverId].sort();

    // Upsert Direct Chat
    let chat = await prisma.directChat.findUnique({
      where: {
        user1Id_user2Id: { user1Id, user2Id },
      },
    });

    if (!chat) {
      chat = await prisma.directChat.create({
        data: {
          user1Id,
          user2Id,
          isDeletedByUser1: false,
          isDeletedByUser2: false,
        },
      });
    } else {
      // Re-enable chat if it was soft-deleted
      chat = await prisma.directChat.update({
        where: { id: chat.id },
        data: {
          isDeletedByUser1: false,
          isDeletedByUser2: false,
        },
      });
    }

    chatId = chat.id;

    // Create the first message inside the chat
    const message = await prisma.directMessage.create({
      data: {
        chatId: chat.id,
        senderId: request.senderId,
        content: request.message,
        isRead: false,
      },
    });

    // Publish acceptance event
    const receiverName = request.receiver.displayName || `${request.receiver.firstName} ${request.receiver.lastName}`.trim() || request.receiver.email;
    await publishEvent(EVENT_TYPES.MESSAGE_REQUEST_ACCEPTED, {
      request: { ...updatedRequest, chatId },
      receiverName,
    });
  } else {
    await publishEvent(EVENT_TYPES.MESSAGE_REQUEST_DECLINED, {
      request: updatedRequest,
    });
  }

  return { request: updatedRequest, chatId };
};

/**
 * List message requests (received or sent)
 */
const listMessageRequests = async (userId, direction = "received") => {
  const where = direction === "sent" 
    ? { senderId: userId, status: "PENDING" } 
    : { receiverId: userId, status: "PENDING" };

  return await prisma.messageRequest.findMany({
    where,
    include: {
      sender: {
        select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
      },
      receiver: {
        select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Send a message inside a direct chat
 */
const sendDirectMessage = async (senderId, chatId, { content, parentId, voiceUrl, voiceDuration }) => {
  const chat = await prisma.directChat.findUnique({
    where: { id: chatId },
  });

  if (!chat) {
    throw new Error("Chat not found.");
  }

  const isUser1 = chat.user1Id === senderId;
  const isUser2 = chat.user2Id === senderId;

  if (!isUser1 && !isUser2) {
    throw new Error("Unauthorized to send messages in this chat.");
  }

  // Determine recipient
  const recipientId = isUser1 ? chat.user2Id : chat.user1Id;

  // Create the message
  const message = await prisma.directMessage.create({
    data: {
      chatId,
      senderId,
      content,
      voiceUrl,
      voiceDuration,
      parentId,
    },
    include: {
      parent: {
        select: { id: true, content: true, senderId: true, createdAt: true },
      },
      sender: {
        select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
      },
    },
  });

  // Update chat timestamps and restore soft-deleted state for recipient if active
  await prisma.directChat.update({
    where: { id: chatId },
    data: {
      updatedAt: new Date(),
      // Reset deletion flags on new message
      isDeletedByUser1: false,
      isDeletedByUser2: false,
    },
  });

  // Publish Event
  const senderName = message.sender.displayName || `${message.sender.firstName} ${message.sender.lastName}`.trim() || message.sender.email;
  await publishEvent(EVENT_TYPES.MESSAGE_SENT, {
    message,
    recipientId,
    senderName,
  });

  return message;
};

/**
 * List all chats a user is part of (with last message & unread count)
 */
const listChats = async (userId) => {
  const chats = await prisma.directChat.findMany({
    where: {
      OR: [
        { user1Id: userId, isDeletedByUser1: false },
        { user2Id: userId, isDeletedByUser2: false },
      ],
    },
    include: {
      user1: {
        select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
      },
      user2: {
        select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const chatDetails = await Promise.all(
    chats.map(async (chat) => {
      const isUser1 = chat.user1Id === userId;
      const otherParticipant = isUser1 ? chat.user2 : chat.user1;
      const isArchived = isUser1 ? chat.isArchivedByUser1 : chat.isArchivedByUser2;

      // Fetch last message
      const lastMessage = await prisma.directMessage.findFirst({
        where: { chatId: chat.id },
        orderBy: { createdAt: "desc" },
        include: {
          parent: {
            select: { id: true, content: true },
          },
        },
      });

      // Count unread messages (sent by the other participant)
      const unreadCount = await prisma.directMessage.count({
        where: {
          chatId: chat.id,
          senderId: { not: userId },
          isRead: false,
        },
      });

      return {
        id: chat.id,
        otherParticipant,
        isArchived,
        lastMessage,
        unreadCount,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      };
    })
  );

  return chatDetails;
};

/**
 * Fetch messages from a direct chat (and mark incoming messages as read)
 */
const getChatMessages = async (userId, chatId, limit = 50, beforeId = null) => {
  const chat = await prisma.directChat.findUnique({
    where: { id: chatId },
  });

  if (!chat) {
    throw new Error("Chat not found.");
  }

  const isUser1 = chat.user1Id === userId;
  const isUser2 = chat.user2Id === userId;

  if ((isUser1 && chat.isDeletedByUser1) || (isUser2 && chat.isDeletedByUser2) || (!isUser1 && !isUser2)) {
    throw new Error("Unauthorized to access this chat.");
  }

  // Construct query where conditions
  const where = { chatId };
  if (beforeId) {
    const beforeMessage = await prisma.directMessage.findUnique({
      where: { id: beforeId },
    });
    if (beforeMessage) {
      where.createdAt = { lt: beforeMessage.createdAt };
    }
  }

  const messages = await prisma.directMessage.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      parent: {
        select: { id: true, content: true, senderId: true, createdAt: true },
      },
      reactions: {
        include: {
          user: {
            select: { id: true, displayName: true, firstName: true, lastName: true },
          },
        },
      },
    },
  });

  // Mark all unread messages sent by the other participant as read
  await prisma.directMessage.updateMany({
    where: {
      chatId,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  // Return messages sorted in chronological order (oldest first)
  return messages.reverse();
};

/**
 * Explicitly mark all messages in a chat as read
 */
const markChatAsRead = async (userId, chatId) => {
  const chat = await prisma.directChat.findUnique({
    where: { id: chatId },
  });

  if (!chat) {
    throw new Error("Chat not found.");
  }

  if (chat.user1Id !== userId && chat.user2Id !== userId) {
    throw new Error("Unauthorized.");
  }

  await prisma.directMessage.updateMany({
    where: {
      chatId,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return { success: true };
};

/**
 * Add or remove (toggle) emoji reaction on a message
 */
const toggleMessageReaction = async (userId, messageId, emoji) => {
  if (!emoji || !emoji.trim()) {
    throw new Error("Emoji is required.");
  }

  const message = await prisma.directMessage.findUnique({
    where: { id: messageId },
    include: { chat: true },
  });

  if (!message) {
    throw new Error("Message not found.");
  }

  // Verify participant
  const chat = message.chat;
  if (chat.user1Id !== userId && chat.user2Id !== userId) {
    throw new Error("Unauthorized to react to this message.");
  }

  // Check if reaction already exists
  const existingReaction = await prisma.directMessageReaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId,
        emoji,
      },
    },
  });

  if (existingReaction) {
    // Remove the reaction (toggle off)
    await prisma.directMessageReaction.delete({
      where: { id: existingReaction.id },
    });
    return { status: "REMOVED", emoji };
  } else {
    // Add the reaction (toggle on)
    const reaction = await prisma.directMessageReaction.create({
      data: {
        messageId,
        userId,
        emoji,
      },
    });
    return { status: "ADDED", reaction };
  }
};

/**
 * Archive direct chat for a specific user
 */
const archiveChat = async (userId, chatId, isArchived) => {
  const chat = await prisma.directChat.findUnique({
    where: { id: chatId },
  });

  if (!chat) {
    throw new Error("Chat not found.");
  }

  const data = {};
  if (chat.user1Id === userId) {
    data.isArchivedByUser1 = isArchived;
  } else if (chat.user2Id === userId) {
    data.isArchivedByUser2 = isArchived;
  } else {
    throw new Error("Unauthorized.");
  }

  return await prisma.directChat.update({
    where: { id: chatId },
    data,
  });
};

/**
 * Soft delete chat for a specific user
 */
const deleteChat = async (userId, chatId) => {
  const chat = await prisma.directChat.findUnique({
    where: { id: chatId },
  });

  if (!chat) {
    throw new Error("Chat not found.");
  }

  const data = {};
  if (chat.user1Id === userId) {
    data.isDeletedByUser1 = true;
  } else if (chat.user2Id === userId) {
    data.isDeletedByUser2 = true;
  } else {
    throw new Error("Unauthorized.");
  }

  return await prisma.directChat.update({
    where: { id: chatId },
    data,
  });
};

module.exports = {
  sendMessageRequest,
  respondToMessageRequest,
  listMessageRequests,
  sendDirectMessage,
  listChats,
  getChatMessages,
  markChatAsRead,
  toggleMessageReaction,
  archiveChat,
  deleteChat,
};
