const test = require("node:test");
const assert = require("node:assert");

// Test getOrCreateDirectChat validation rules
test("getOrCreateDirectChat rejects chat creation with yourself", async () => {
  const messagingService = require("../src/modules/messaging/services/messaging.service");
  await assert.rejects(
    async () => {
      await messagingService.getOrCreateDirectChat("user1", "user1");
    },
    {
      name: "Error",
      message: "Cannot create a chat with yourself.",
    }
  );
});

test("getOrCreateDirectChat rejects when recipientId is missing", async () => {
  const messagingService = require("../src/modules/messaging/services/messaging.service");
  await assert.rejects(
    async () => {
      await messagingService.getOrCreateDirectChat("user1", null);
    },
    {
      name: "Error",
      message: "recipientId is required.",
    }
  );
});
