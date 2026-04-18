const EVENT_TYPES = require("../eventTypes");
const { createNotification } = require("../../modules/notifications/services/notification.service");
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

module.exports = { registerNotificationListeners };
