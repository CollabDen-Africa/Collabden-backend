const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Publisher client — used for publishing events
const publisherClient = new Redis(REDIS_URL);

// Subscriber client — Redis requires a dedicated connection for subscriptions
const subscriberClient = new Redis(REDIS_URL);

publisherClient.on("connect", () => {
  console.log("Redis publisher connected");
});

publisherClient.on("error", (err) => {
  console.error("Redis publisher error:", err.message);
});

subscriberClient.on("connect", () => {
  console.log("Redis subscriber connected");
});

subscriberClient.on("error", (err) => {
  console.error("Redis subscriber error:", err.message);
});

module.exports = { publisherClient, subscriberClient };
