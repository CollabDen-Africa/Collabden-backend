const EVENT_TYPES = require("../eventTypes");
const { createNotification } = require("../../modules/notifications/services/notification.service");
const { shouldSend } = require("../../modules/notifications/services/notificationSetting.service");
const { sendToUser } = require("../../config/websocket");
/**
 * Register all notification-related event listeners on the Redis subscriber.
 * @param {import("ioredis").Redis} subscriberClient
 */
const registerNotificationListeners = (subscriberClient) => {
  // Subscribe to notification-related channels
  subscriberClient.subscribe(
    EVENT_TYPES.PROJECT_CREATED,
    EVENT_TYPES.COLLABORATOR_INVITED,
    EVENT_TYPES.MESSAGE_REQUEST_SENT,
    EVENT_TYPES.MESSAGE_REQUEST_ACCEPTED,
    EVENT_TYPES.MESSAGE_SENT,
    (err) => {
      if (err) {
        console.error("[Subscriber] Failed to subscribe:", err.message);
      }
    }
  );

  subscriberClient.on("message", async (channel, message) => {
    try {
      const payload = JSON.parse(message);

      switch (channel) {
        case EVENT_TYPES.PROJECT_CREATED:
          await handleProjectCreated(payload);
          break;

        case EVENT_TYPES.COLLABORATOR_INVITED:
          await handleCollaboratorInvited(payload);
          break;

        case EVENT_TYPES.MESSAGE_REQUEST_SENT:
          await handleMessageRequestSent(payload);
          break;

        case EVENT_TYPES.MESSAGE_REQUEST_ACCEPTED:
          await handleMessageRequestAccepted(payload);
          break;

        case EVENT_TYPES.MESSAGE_SENT:
          await handleMessageSent(payload);
          break;

        default:
          console.log(`[Listener] Unhandled channel: ${channel}`);
      }
    } catch (error) {
      console.error(`[Listener Error] ${channel}:`, error.message);
    }
  });
};

/**
 * Handle PROJECT_CREATED event:
 * - Create a notification in the database
 * - Push real-time notification via WebSocket
 */
const handleProjectCreated = async ({ project, userId }) => {
  console.log(`[Listener] Processing PROJECT_CREATED for user ${userId}`);

  const canSendInApp = await shouldSend(userId, "inApp");
  if (!canSendInApp) {
    console.log(`[Listener] Skipping in-app notification for user ${userId} (settings disabled)`);
    return;
  }

  const notification = await createNotification({
    userId,
    title: "Project Created",
    message: `Your project "${project.name}" has been created successfully.`,
    type: "PROJECT_CREATED",
    link: `/projects/${project.id}`,
  });

  // Push real-time notification to the user
  sendToUser(userId, {
    type: "NOTIFICATION",
    data: notification,
  });
};

/**
 * Handle COLLABORATOR_INVITED event:
 * - Create a notification for the invited user
 * - Push real-time notification via WebSocket
 */
const handleCollaboratorInvited = async ({ projectId, projectName, collaboratorId }) => {
  console.log(`[Listener] Processing COLLABORATOR_INVITED for user ${collaboratorId}`);

  const canSendInApp = await shouldSend(collaboratorId, "inApp");
  if (!canSendInApp) {
    console.log(`[Listener] Skipping in-app notification for user ${collaboratorId} (settings disabled)`);
    return;
  }

  const notification = await createNotification({
    userId: collaboratorId,
    title: "New Project Invitation",
    message: `You have been invited to collaborate on "${projectName}".`,
    type: "INVITE",
    link: `/projects/${projectId}`,
  });

  // Push real-time notification to the invited user
  sendToUser(collaboratorId, {
    type: "NOTIFICATION",
    data: notification,
  });
};

/**
 * Handle MESSAGE_REQUEST_SENT event:
 * - Create a notification for the receiver
 * - Push real-time updates via WebSocket
 */
const handleMessageRequestSent = async ({ request, senderName }) => {
  console.log(`[Listener] Processing MESSAGE_REQUEST_SENT for user ${request.receiverId}`);

  // Send the actual request object for real-time inbox updates (always send this)
  sendToUser(request.receiverId, {
    type: "MESSAGE_REQUEST_RECEIVED",
    data: request,
  });

  const canSendInApp = await shouldSend(request.receiverId, "inApp");
  if (!canSendInApp) {
    console.log(`[Listener] Skipping in-app notification for user ${request.receiverId} (settings disabled)`);
    return;
  }

  const notification = await createNotification({
    userId: request.receiverId,
    title: "New Message Request",
    message: `You have a new message request from ${senderName || "another user"}.`,
    type: "MESSAGE",
    link: `/messages/requests`,
  });

  // Send notification to the user
  sendToUser(request.receiverId, {
    type: "NOTIFICATION",
    data: notification,
  });
};

/**
 * Handle MESSAGE_REQUEST_ACCEPTED event:
 * - Create a notification for the sender
 * - Push real-time updates via WebSocket
 */
const handleMessageRequestAccepted = async ({ request, receiverName }) => {
  console.log(`[Listener] Processing MESSAGE_REQUEST_ACCEPTED for user ${request.senderId}`);

  // Send event for real-time chat activation (always send this)
  sendToUser(request.senderId, {
    type: "MESSAGE_REQUEST_ACCEPTED",
    data: request,
  });

  const canSendInApp = await shouldSend(request.senderId, "inApp");
  if (!canSendInApp) {
    console.log(`[Listener] Skipping in-app notification for user ${request.senderId} (settings disabled)`);
    return;
  }

  const notification = await createNotification({
    userId: request.senderId,
    title: "Message Request Accepted",
    message: `${receiverName || "A user"} accepted your message request.`,
    type: "MESSAGE",
    link: `/messages/chat/${request.chatId}`,
  });

  // Send notification to the sender
  sendToUser(request.senderId, {
    type: "NOTIFICATION",
    data: notification,
  });
};

/**
 * Handle MESSAGE_SENT event:
 * - Push real-time direct message via WebSocket to the receiver
 * - Create a database notification for the receiver
 */
const handleMessageSent = async ({ message, recipientId, senderName }) => {
  console.log(`[Listener] Processing MESSAGE_SENT for user ${recipientId}`);

  // Send the message payload directly for active chat updates (always send this)
  sendToUser(recipientId, {
    type: "DIRECT_MESSAGE",
    data: message,
  });

  const canSendInApp = await shouldSend(recipientId, "inApp");
  if (!canSendInApp) {
    console.log(`[Listener] Skipping in-app notification for user ${recipientId} (settings disabled)`);
    return;
  }

  // Create a database notification
  const notification = await createNotification({
    userId: recipientId,
    title: "New Direct Message",
    message: `You received a message from ${senderName || "a collaborator"}.`,
    type: "MESSAGE",
    link: `/messages/chat/${message.chatId}`,
  });

  // Send real-time notification alert
  sendToUser(recipientId, {
    type: "NOTIFICATION",
    data: notification,
  });
};

module.exports = { registerNotificationListeners };
