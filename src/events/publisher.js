const { publisherClient } = require("../config/redis");

/**
 * Publish an event to a Redis channel.
 * @param {string} eventType - The event channel name (from eventTypes.js)
 * @param {object} payload - The event data to publish
 */
const publishEvent = async (eventType, payload) => {
  try {
    const message = JSON.stringify(payload);
    await publisherClient.publish(eventType, message);
    console.log(`[Event Published] ${eventType}`, payload);
  } catch (error) {
    console.error(`[Event Publish Error] ${eventType}:`, error.message);
  }
};

module.exports = { publishEvent };
