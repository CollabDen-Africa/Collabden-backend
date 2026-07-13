const EVENT_TYPES = require("../eventTypes");
const { createNotification } = require("../../modules/notifications/services/notification.service");
const { shouldSend } = require("../../modules/notifications/services/notificationSetting.service");
const { sendToUser } = require("../../config/websocket");
const prisma = require("../../config/prismaClient");

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
    EVENT_TYPES.CONNECTION_REQUEST_SENT,
    EVENT_TYPES.CONNECTION_REQUEST_ACCEPTED,
    EVENT_TYPES.AVAILABILITY_STATUS_UPDATED,
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

        case EVENT_TYPES.CONNECTION_REQUEST_SENT:
          await handleConnectionRequestSent(payload);
          break;

        case EVENT_TYPES.CONNECTION_REQUEST_ACCEPTED:
          await handleConnectionRequestAccepted(payload);
          break;

        case EVENT_TYPES.AVAILABILITY_STATUS_UPDATED:
          await handleAvailabilityStatusUpdated(payload);
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

/**
 * Handle CONNECTION_REQUEST_SENT event:
 * - Create a notification for the receiver
 * - Push real-time notification via WebSocket
 */
const handleConnectionRequestSent = async ({ senderId, receiverId, connectionId }) => {
  console.log(`[Listener] Processing CONNECTION_REQUEST_SENT for user ${receiverId}`);

  // Fetch sender profile details to display their name
  const sender = await prisma.userProfile.findUnique({
    where: { id: senderId },
    select: { displayName: true, firstName: true, lastName: true },
  });
  const senderName = sender ? (sender.displayName || `${sender.firstName} ${sender.lastName}`) : "A collaborator";

  const canSendInApp = await shouldSend(receiverId, "inApp");
  if (!canSendInApp) {
    console.log(`[Listener] Skipping in-app notification for user ${receiverId} (settings disabled)`);
    return;
  }

  const notification = await createNotification({
    userId: receiverId,
    title: "New Connection Request",
    message: `${senderName} sent you a connection request.`,
    type: "CONNECTION_REQUEST",
    link: `/profile/connections`,
  });

  // Push real-time notification to the receiver
  sendToUser(receiverId, {
    type: "NOTIFICATION",
    data: notification,
  });
};

/**
 * Handle CONNECTION_REQUEST_ACCEPTED event:
 * - Create a notification for the sender
 * - Push real-time notification via WebSocket
 */
const handleConnectionRequestAccepted = async ({ senderId, receiverId, connectionId }) => {
  console.log(`[Listener] Processing CONNECTION_REQUEST_ACCEPTED for user ${senderId}`);

  // Fetch receiver profile details (who accepted) to display their name
  const receiver = await prisma.userProfile.findUnique({
    where: { id: receiverId },
    select: { displayName: true, firstName: true, lastName: true },
  });
  const receiverName = receiver ? (receiver.displayName || `${receiver.firstName} ${receiver.lastName}`) : "A collaborator";

  const canSendInApp = await shouldSend(senderId, "inApp");
  if (!canSendInApp) {
    console.log(`[Listener] Skipping in-app notification for user ${senderId} (settings disabled)`);
    return;
  }

  const notification = await createNotification({
    userId: senderId,
    title: "Connection Request Accepted",
    message: `${receiverName} accepted your connection request.`,
    type: "CONNECTION_REQUEST",
    link: `/profile/${receiverId}`,
  });

  // Push real-time notification to the sender
  sendToUser(senderId, {
    type: "NOTIFICATION",
    data: notification,
  });
};

/**
 * Handle AVAILABILITY_STATUS_UPDATED event:
 * - Create a notification for the user themselves
 * - Push real-time notification via WebSocket
 */
const handleAvailabilityStatusUpdated = async ({ userId, openToCollaborate }) => {
  console.log(`[Listener] Processing AVAILABILITY_STATUS_UPDATED for user ${userId}`);

  const canSendInApp = await shouldSend(userId, "inApp");
  if (!canSendInApp) {
    console.log(`[Listener] Skipping in-app notification for user ${userId} (settings disabled)`);
    return;
  }

  const statusText = openToCollaborate ? "Open to Collaborate" : "Not Open to Collaborate";
  const notification = await createNotification({
    userId,
    title: "Availability Status Updated",
    message: `Your availability status is now set to "${statusText}".`,
    type: "STATUS_UPDATE",
    link: `/profile/settings`,
  });

  // Push real-time notification to the user
  sendToUser(userId, {
    type: "NOTIFICATION",
    data: notification,
  });
};

module.exports = { registerNotificationListeners };
