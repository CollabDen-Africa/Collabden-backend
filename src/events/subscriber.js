const { subscriberClient } = require("../config/redis");
const { registerNotificationListeners } = require("./listeners/notification.listener");

/**
 * Initialize all Redis event subscribers.
 * Each listener module registers its own channels and handlers.
 */
const initSubscribers = () => {
  registerNotificationListeners(subscriberClient);
  console.log("Event subscribers initialized");
};

module.exports = { initSubscribers };
