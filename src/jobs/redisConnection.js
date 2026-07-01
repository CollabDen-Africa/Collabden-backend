const Redis = require("ioredis");

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// BullMQ requires maxRetriesPerRequest to be null
const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

connection.on("connect", () => {
  console.log("BullMQ Redis connection established");
});

connection.on("error", (err) => {
  console.error("BullMQ Redis error:", err.message);
});

module.exports = connection;
