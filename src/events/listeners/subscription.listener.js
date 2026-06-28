const EVENT_TYPES = require("../eventTypes");
const { createNotification } = require("../../modules/notifications/services/notification.service");
const { sendToUser } = require("../../config/websocket");
const prisma = require("../../config/prismaClient");

const registerSubscriptionListeners = (subscriberClient) => {
  subscriberClient.subscribe(
    EVENT_TYPES.SUBSCRIPTION_ACTIVATED,
    EVENT_TYPES.SUBSCRIPTION_CANCELLED,
    EVENT_TYPES.SUBSCRIPTION_RENEWED,
    EVENT_TYPES.SUBSCRIPTION_EXPIRED,
    EVENT_TYPES.SUBSCRIPTION_PAST_DUE,
    (err) => {
      if (err) {
        console.error("[Subscriber] Failed to subscribe to subscription events:", err.message);
      }
    }
  );

  subscriberClient.on("message", async (channel, message) => {
    try {
      const payload = JSON.parse(message);

      switch (channel) {
        case EVENT_TYPES.SUBSCRIPTION_ACTIVATED:
          await handleSubscriptionActivated(payload);
          break;
        case EVENT_TYPES.SUBSCRIPTION_CANCELLED:
          await handleSubscriptionCancelled(payload);
          break;
        // other cases can be handled here
      }
    } catch (error) {
      console.error(`[Subscription Listener Error] ${channel}:`, error.message);
    }
  });
};

const handleSubscriptionActivated = async ({ userId, tier, amount, periodEnd }) => {
  const notification = await createNotification({
    userId,
    title: "Subscription Activated",
    message: `Your ${tier} subscription is now active! Valid until ${new Date(periodEnd).toLocaleDateString()}.`,
    type: "SUBSCRIPTION_ACTIVATED",
    link: "/settings/billing",
  });

  sendToUser(userId, {
    type: "NOTIFICATION",
    data: notification,
  });
  
  sendToUser(userId, {
    type: "SUBSCRIPTION_UPDATED",
    data: { tier, status: "ACTIVE" },
  });
};

const handleSubscriptionCancelled = async ({ userId, tier, periodEnd }) => {
  const notification = await createNotification({
    userId,
    title: "Subscription Cancelled",
    message: `Your ${tier} subscription has been cancelled and will end on ${new Date(periodEnd).toLocaleDateString()}.`,
    type: "SUBSCRIPTION_CANCELLED",
    link: "/settings/billing",
  });

  sendToUser(userId, {
    type: "NOTIFICATION",
    data: notification,
  });
  
  sendToUser(userId, {
    type: "SUBSCRIPTION_UPDATED",
    data: { cancelAtPeriodEnd: true },
  });
};

module.exports = { registerSubscriptionListeners };
