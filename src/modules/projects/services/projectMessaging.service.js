const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const { resolveMessageVoiceUrls } = require("../../messaging/services/voiceUpload.service");
const { resolveMessageAttachmentUrls } = require("./projectMessageAttachments.service");

const MAX_VOICE_DURATION_SECONDS = 180;
const MAX_CONTENT_LENGTH = 5000;
const MAX_ATTACHMENTS = 10;

const SENDER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  displayName: true,
  legalName: true,
  avatarUrl: true,
};

const MESSAGE_INCLUDE = {
  sender: { select: SENDER_SELECT },
  attachments: true,
  reactions: {
    include: {
      user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  reads: { select: { userId: true, readAt: true } },
  parent: {
    select: {
      id: true,
      content: true,
      messageType: true,
      voiceUrl: true,
      senderId: true,
      createdAt: true,
      sender: { select: { id: true, displayName: true, firstName: true, lastName: true } },
    },
  },
};

const httpError = (message, status) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const assertProjectAccess = async (projectId, userId) => {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      isDeleted: false,
      OR: [
        { ownerId: userId },
        { collaborators: { some: { userId, isActive: true } } },
      ],
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
      collaborators: {
        where: { isActive: true },
        select: { userId: true },
      },
    },
  });
  if (!project) {
    throw httpError("Project not found or you do not have access to its messages.", 404);
  }
  return project;
};

const collectRecipientIds = (project, excludeUserId) => {
  const ids = new Set();
  if (project.ownerId && project.ownerId !== excludeUserId) ids.add(project.ownerId);
  for (const c of project.collaborators) {
    if (c.userId !== excludeUserId) ids.add(c.userId);
  }
  return Array.from(ids);
};

const senderDisplayName = (sender) =>
  sender?.displayName ||
  sender?.legalName ||
  [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") ||
  sender?.email ||
  "A collaborator";

const sanitizeAttachments = (attachments) => {
  if (!attachments) return [];
  if (!Array.isArray(attachments)) {
    throw httpError("attachments must be an array.", 400);
  }
  if (attachments.length > MAX_ATTACHMENTS) {
    throw httpError(`A message cannot have more than ${MAX_ATTACHMENTS} attachments.`, 400);
  }
  return attachments.map((a) => {
    if (!a || typeof a.url !== "string" || !a.url.trim()) {
      throw httpError("Each attachment must include a url.", 400);
    }
    return {
      url: a.url.trim(),
      name: typeof a.name === "string" ? a.name.trim() : null,
      mimeType: typeof a.mimeType === "string" ? a.mimeType.trim() : null,
      size: Number.isFinite(a.size) ? Math.trunc(a.size) : null,
    };
  });
};

const sendProjectMessage = async (
  projectId,
  userId,
  { content, parentId, voiceUrl, voiceDuration, attachments } = {}
) => {
  const project = await assertProjectAccess(projectId, userId);

  const trimmedContent = typeof content === "string" ? content.trim() : "";
  const normalizedAttachments = sanitizeAttachments(attachments);
  const hasVoice = typeof voiceUrl === "string" && voiceUrl.trim().length > 0;

  if (!trimmedContent && !hasVoice && normalizedAttachments.length === 0) {
    throw httpError("A message must include content, a voice note, or at least one attachment.", 400);
  }

  if (trimmedContent.length > MAX_CONTENT_LENGTH) {
    throw httpError(`Message content cannot exceed ${MAX_CONTENT_LENGTH} characters.`, 400);
  }

  if (hasVoice) {
    const duration = Number(voiceDuration);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw httpError("voiceDuration (seconds) is required for voice notes.", 400);
    }
    if (duration > MAX_VOICE_DURATION_SECONDS) {
      throw httpError(`Voice notes cannot exceed ${MAX_VOICE_DURATION_SECONDS} seconds.`, 400);
    }
  }

  if (parentId) {
    const parent = await prisma.projectMessage.findUnique({
      where: { id: parentId },
      select: { id: true, projectId: true },
    });
    if (!parent || parent.projectId !== projectId) {
      throw httpError("Reply target message was not found in this project.", 400);
    }
  }

  const activeCollaborators = project.collaborators.filter((c) => c.userId !== project.ownerId);
  if (activeCollaborators.length === 0) {
    throw httpError(
      "Cannot send messages. There are no active collaborators in this project yet. Invite collaborators to start messaging.",
      400
    );
  }

  const messageType = hasVoice ? "VOICE" : "TEXT";

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.projectMessage.create({
      data: {
        projectId,
        senderId: userId,
        content: trimmedContent || null,
        messageType,
        voiceUrl: hasVoice ? voiceUrl.trim() : null,
        voiceDuration: hasVoice ? Math.trunc(Number(voiceDuration)) : null,
        parentId: parentId || null,
        attachments: normalizedAttachments.length
          ? { createMany: { data: normalizedAttachments } }
          : undefined,
        reads: {
          create: { userId },
        },
      },
      include: MESSAGE_INCLUDE,
    });

    await tx.activityLog.create({
      data: {
        projectId,
        action: "PROJECT_MESSAGE_SENT",
        details: `${senderDisplayName(created.sender)} sent a ${messageType === "VOICE" ? "voice note" : "message"}.`,
      },
    });

    return created;
  });

  await Promise.all([
    resolveMessageVoiceUrls([message]),
    resolveMessageAttachmentUrls([message]),
  ]);

  const recipientIds = collectRecipientIds(project, userId);
  await publishEvent(EVENT_TYPES.PROJECT_MESSAGE_SENT, {
    message,
    projectId,
    projectName: project.name,
    senderId: userId,
    senderName: senderDisplayName(message.sender),
    recipientIds,
  });

  return message;
};

const listProjectMessages = async (projectId, userId, { limit = 50, beforeId } = {}) => {
  await assertProjectAccess(projectId, userId);

  const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const where = { projectId };

  if (beforeId) {
    const cursor = await prisma.projectMessage.findUnique({
      where: { id: beforeId },
      select: { createdAt: true, projectId: true },
    });
    if (cursor && cursor.projectId === projectId) {
      where.createdAt = { lt: cursor.createdAt };
    }
  }

  const messages = await prisma.projectMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: MESSAGE_INCLUDE,
  });

  const unreadIds = messages
    .filter((m) => m.senderId !== userId && !m.reads.some((r) => r.userId === userId))
    .map((m) => m.id);

  if (unreadIds.length) {
    await prisma.projectMessageRead.createMany({
      data: unreadIds.map((messageId) => ({ messageId, userId })),
      skipDuplicates: true,
    });
  }

  await Promise.all([
    resolveMessageVoiceUrls(messages),
    resolveMessageAttachmentUrls(messages),
  ]);

  return messages.reverse();
};

const markProjectMessagesRead = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);

  const unread = await prisma.projectMessage.findMany({
    where: {
      projectId,
      senderId: { not: userId },
      reads: { none: { userId } },
    },
    select: { id: true },
  });

  if (unread.length === 0) {
    return { marked: 0 };
  }

  await prisma.projectMessageRead.createMany({
    data: unread.map((m) => ({ messageId: m.id, userId })),
    skipDuplicates: true,
  });

  return { marked: unread.length };
};

const toggleProjectMessageReaction = async (userId, messageId, emoji) => {
  if (!emoji || typeof emoji !== "string" || !emoji.trim()) {
    throw httpError("Emoji is required.", 400);
  }

  const message = await prisma.projectMessage.findUnique({
    where: { id: messageId },
    select: { id: true, projectId: true },
  });
  if (!message) {
    throw httpError("Message not found.", 404);
  }

  await assertProjectAccess(message.projectId, userId);

  const normalizedEmoji = emoji.trim();
  const existing = await prisma.projectMessageReaction.findUnique({
    where: {
      messageId_userId_emoji: { messageId, userId, emoji: normalizedEmoji },
    },
  });

  if (existing) {
    await prisma.projectMessageReaction.delete({ where: { id: existing.id } });
    return { status: "REMOVED", emoji: normalizedEmoji };
  }

  const reaction = await prisma.projectMessageReaction.create({
    data: { messageId, userId, emoji: normalizedEmoji },
    include: {
      user: { select: { id: true, displayName: true, firstName: true, lastName: true, avatarUrl: true } },
    },
  });
  return { status: "ADDED", reaction };
};

module.exports = {
  sendProjectMessage,
  listProjectMessages,
  markProjectMessagesRead,
  toggleProjectMessageReaction,
  MAX_VOICE_DURATION_SECONDS,
  MAX_CONTENT_LENGTH,
  MAX_ATTACHMENTS,
};
