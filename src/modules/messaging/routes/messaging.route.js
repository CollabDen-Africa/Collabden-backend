const express = require("express");
const multer = require("multer");
const router = express.Router();
const { authMiddleware } = require("../../../middleware/auth.middleware");
const {
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
  postCreateChat,
  postVoiceUpload,
  postDirectAttachmentUpload,
} = require("../controllers/messaging.controller");
const { MAX_VOICE_BYTES } = require("../services/voiceUpload.service");
const { MAX_DM_ATTACHMENT_BYTES, ALLOWED_DM_ATTACHMENT_MIME_TYPES } = require("../services/directMessageAttachments.service");

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VOICE_BYTES },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed for voice notes."), false);
    }
  },
});

const dmAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DM_ATTACHMENT_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_DM_ATTACHMENT_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported attachment type. Allowed: images, PDFs, Office docs, and audio clips."), false);
    }
  },
});

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Messaging
 *   description: Direct messaging, message requests, reactions, replies, and conversation controls.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     MessageRequest:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: mr123
 *         senderId:
 *           type: string
 *           example: user_a
 *         receiverId:
 *           type: string
 *           example: user_b
 *         message:
 *           type: string
 *           example: Hey, I love your music, would love to collaborate on a new track!
 *         status:
 *           type: string
 *           enum: [PENDING, ACCEPTED, DECLINED]
 *           example: PENDING
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     DirectChat:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: chat123
 *         otherParticipant:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: user_b
 *             email:
 *               type: string
 *               example: userb@example.com
 *             displayName:
 *               type: string
 *               example: BeatMaker
 *         isArchived:
 *           type: boolean
 *           example: false
 *         lastMessage:
 *           $ref: '#/components/schemas/DirectMessage'
 *         unreadCount:
 *           type: integer
 *           example: 3
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     DirectMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: msg123
 *         chatId:
 *           type: string
 *           example: chat123
 *         senderId:
 *           type: string
 *           example: user_a
 *         content:
 *           type: string
 *           nullable: true
 *           example: Hello world
 *         voiceUrl:
 *           type: string
 *           nullable: true
 *           example: https://storage.collabden.com/voices/msg123.mp3
 *         voiceDuration:
 *           type: integer
 *           nullable: true
 *           example: 12
 *         isRead:
 *           type: boolean
 *           example: false
 *         parentId:
 *           type: string
 *           nullable: true
 *           example: parentMsg123
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/messaging/requests:
 *   post:
 *     summary: Send a message request to an unconnected user
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - receiverId
 *               - message
 *             properties:
 *               receiverId:
 *                 type: string
 *                 description: ID of the recipient user
 *                 example: receiver_id_123
 *               message:
 *                 type: string
 *                 description: Initial message content
 *                 example: Hi, I'd like to talk about collaboration!
 *     responses:
 *       201:
 *         description: Message request created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageRequest'
 *       400:
 *         description: Bad request / already connected / already requested
 *       401:
 *         description: Unauthorized
 */
router.post("/requests", postMessageRequest);

/**
 * @swagger
 * /api/v1/messaging/requests/{id}:
 *   patch:
 *     summary: Respond to a pending message request (Accept or Decline)
 *     description: Accepts or declines a message request. Accepting automatically creates a DirectChat session and puts the initial message as the first chat message.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The message request ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACCEPTED, DECLINED]
 *                 example: ACCEPTED
 *     responses:
 *       200:
 *         description: Responded successfully. If accepted, returns the updated request and the created chatId.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 request:
 *                   $ref: '#/components/schemas/MessageRequest'
 *                 chatId:
 *                   type: string
 *                   nullable: true
 *                   example: chat123
 *       400:
 *         description: Bad request / already processed / invalid status
 *       401:
 *         description: Unauthorized
 */
router.patch("/requests/:id", patchMessageRequest);

/**
 * @swagger
 * /api/v1/messaging/requests:
 *   get:
 *     summary: List pending message requests
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: direction
 *         schema:
 *           type: string
 *           enum: [sent, received]
 *           default: received
 *         description: Whether to get sent requests or received requests
 *     responses:
 *       200:
 *         description: List of message requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MessageRequest'
 *       401:
 *         description: Unauthorized
 */
router.get("/requests", getMessageRequests);

/**
 * @swagger
 * /api/v1/messaging/chats:
 *   get:
 *     summary: List all direct chats the authenticated user is part of
 *     description: Returns a list of chats including details about the other participant, unread count, and the last message.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of direct chats
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DirectChat'
 *       401:
 *         description: Unauthorized
 */
router.get("/chats", getChats);
router.post("/chats", postCreateChat);

/**
 * @swagger
 * /api/v1/messaging/chats/{chatId}/messages:
 *   get:
 *     summary: Fetch message history for a direct chat
 *     description: Returns messages belonging to a chat, sorted in chronological order (oldest first). Fetched unread messages sent by the other participant are marked as read.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages to retrieve
 *       - in: query
 *         name: beforeId
 *         schema:
 *           type: string
 *         description: Message ID cursor for paginating backwards
 *     responses:
 *       200:
 *         description: List of messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DirectMessage'
 *       400:
 *         description: Bad request / Unauthorized access
 *       401:
 *         description: Unauthorized
 */
router.get("/chats/:chatId/messages", getChatMessagesHandler);

/**
 * @swagger
 * /api/v1/messaging/chats/{chatId}/messages:
 *   post:
 *     summary: Send a direct message in a chat
 *     description: Sends a new message or voice note. Supports thread replies by referencing parentId.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Text content of the message
 *                 example: Hey! Let's schedule a studio session.
 *               parentId:
 *                 type: string
 *                 description: ID of the message being replied to
 *                 example: msg_parent_123
 *               voiceUrl:
 *                 type: string
 *                 description: URL to recorded voice note file
 *                 example: https://storage.collabden.com/voices/msg_123.mp3
 *               voiceDuration:
 *                 type: integer
 *                 description: Duration of voice note in seconds
 *                 example: 30
 *     responses:
 *       201:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DirectMessage'
 *       400:
 *         description: Bad request / Unauthorized access
 *       401:
 *         description: Unauthorized
 */
router.post("/chats/:chatId/messages", postDirectMessage);

/**
 * @swagger
 * /api/v1/messaging/chats/{chatId}/read:
 *   patch:
 *     summary: Mark all unread messages in a chat as read
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.patch("/chats/:chatId/read", patchChatRead);

/**
 * @swagger
 * /api/v1/messaging/messages/{messageId}/reactions:
 *   post:
 *     summary: Add or remove (toggle) emoji reaction on a message
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - emoji
 *             properties:
 *               emoji:
 *                 type: string
 *                 description: The emoji character
 *                 example: 🔥
 *     responses:
 *       200:
 *         description: Reaction toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ADDED, REMOVED]
 *                   example: ADDED
 *                 reaction:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: string
 *                     messageId:
 *                       type: string
 *                     userId:
 *                       type: string
 *                     emoji:
 *                       type: string
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post("/messages/:messageId/reactions", postMessageReaction);

/**
 * @swagger
 * /api/v1/messaging/chats/{chatId}/archive:
 *   patch:
 *     summary: Archive or unarchive a direct chat conversation for the user
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isArchived
 *             properties:
 *               isArchived:
 *                 type: boolean
 *                 description: Whether to archive the chat
 *                 example: true
 *     responses:
 *       200:
 *         description: Chat archived / unarchived successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.patch("/chats/:chatId/archive", patchChatArchive);

/**
 * @swagger
 * /api/v1/messaging/chats/{chatId}:
 *   delete:
 *     summary: Soft delete direct chat conversation history for the user
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation deleted successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.delete("/chats/:chatId", deleteChatHandler);

/**
 * @swagger
 * /api/v1/messaging/voice:
 *   post:
 *     summary: Upload a voice note (used by both DMs and project messaging)
 *     description: |
 *       Accepts a short audio recording (max 3 minutes, 10 MB), stores it in the private
 *       `voice-notes` bucket, and returns the Supabase storage path plus a short-lived signed
 *       playback URL. Submit the returned `path` as `voiceUrl` when calling
 *       `POST /messaging/chats/:chatId/messages` or `POST /projects/:id/messages` —
 *       read endpoints will re-sign the URL on fetch so recipients always get a fresh link.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [voice, durationSeconds]
 *             properties:
 *               voice:
 *                 type: string
 *                 format: binary
 *                 description: Audio file (webm, ogg, m4a, aac, mp3, wav)
 *               durationSeconds:
 *                 type: integer
 *                 description: Recorded duration (1–180 seconds)
 *     responses:
 *       201:
 *         description: Voice note uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 path:
 *                   type: string
 *                   description: Storage key to submit as voiceUrl on message create
 *                 signedUrl:
 *                   type: string
 *                 mimeType:
 *                   type: string
 *                 size:
 *                   type: integer
 *                 durationSeconds:
 *                   type: integer
 *                 expiresInSeconds:
 *                   type: integer
 *       400:
 *         description: Invalid payload (missing duration, bad mime, etc.)
 *       413:
 *         description: File larger than 10 MB or duration longer than 180s
 */
router.post("/voice", voiceUpload.single("voice"), postVoiceUpload);

/**
 * @swagger
 * /api/v1/messaging/attachments:
 *   post:
 *     summary: Upload an attachment for a direct message
 *     description: |
 *       Accepts one file (max 10 MB) and stores it in the private `direct-message-attachments`
 *       bucket. Returns a storage key (`url`) plus a short-lived signed preview URL.
 *       Pass the returned `url`, `name`, `mimeType`, and `size` inside the `attachments`
 *       array when calling `POST /messaging/chats/:chatId/messages` — read endpoints will
 *       re-sign the URL on fetch so recipients always get a fresh link.
 *       **Important:** use `url` (the storage key), not `signedUrl`, in the attachments payload —
 *       signed URLs expire after 1 hour and will not be refreshed.
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Attachment uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   description: Storage key — pass this as `url` in the attachments array
 *                   example: userId/1234567890-abc123-photo.jpg
 *                 path:
 *                   type: string
 *                   description: Alias for `url` (same value)
 *                   example: userId/1234567890-abc123-photo.jpg
 *                 signedUrl:
 *                   type: string
 *                   description: Short-lived preview URL (1 hour TTL) — do NOT store this
 *                   example: https://example.supabase.co/storage/v1/object/sign/...
 *                 name:
 *                   type: string
 *                   example: photo.jpg
 *                 mimeType:
 *                   type: string
 *                   example: image/jpeg
 *                 size:
 *                   type: integer
 *                   example: 204800
 *                 expiresInSeconds:
 *                   type: integer
 *                   example: 3600
 *       400:
 *         description: Missing file or unsupported type
 *       413:
 *         description: File larger than 10 MB
 */
router.post("/attachments", dmAttachmentUpload.single("file"), postDirectAttachmentUpload);

module.exports = router;
