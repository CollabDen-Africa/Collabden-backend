const { subscriberClient } = require("../config/redis");
const { registerNotificationListeners } = require("./listeners/notification.listener");
const { registerWorkspaceListeners } = require("./listeners/workspace.listener");
const { registerPaymentListeners } = require("./listeners/payment.listener");
const { registerSubscriptionListeners } = require("./listeners/subscription.listener");

/**
 * Initialize all Redis event subscribers.
 * Each listener module registers its own channels and handlers.
 */
const initSubscribers = () => {
  registerNotificationListeners(subscriberClient);
  registerWorkspaceListeners(subscriberClient);
  registerPaymentListeners(subscriberClient);
  registerSubscriptionListeners(subscriberClient);
  console.log("Event subscribers initialized");
};

module.exports = { initSubscribers };
