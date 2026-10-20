const { WebSocketServer } = require("ws");

// Map of userId -> Set of WebSocket connections
const userConnections = new Map();

let wss;

/**
 * Initialize the WebSocket server, attaching it to an existing HTTP server.
 * @param {import("http").Server} server - The HTTP server instance
 */
const initWebSocket = (server) => {
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    let authenticatedUserId = null;

    ws.on("message", (data) => {
      try {
        const parsed = JSON.parse(data);

        // Client must send { type: "AUTH", userId: "..." } to register
        if (parsed.type === "AUTH" && parsed.userId) {
          authenticatedUserId = parsed.userId;

          if (!userConnections.has(authenticatedUserId)) {
            userConnections.set(authenticatedUserId, new Set());
          }
          userConnections.get(authenticatedUserId).add(ws);

          console.log(`[WebSocket] User ${authenticatedUserId} connected`);
          ws.send(JSON.stringify({ type: "AUTH_SUCCESS" }));
          return;
        }

        // Typing indicator relay: forward {TYPING, chatId, recipientId, isTyping}
        // from the authenticated sender to the specified recipient only.
        if (parsed.type === "TYPING" && authenticatedUserId && parsed.recipientId && parsed.chatId) {
          sendToUser(parsed.recipientId, {
            type: "TYPING",
            data: {
              chatId: parsed.chatId,
              userId: authenticatedUserId,
              isTyping: Boolean(parsed.isTyping),
            },
          });
        }
      } catch (err) {
        // Ignore non-JSON messages
      }
    });

    ws.on("close", () => {
      if (authenticatedUserId && userConnections.has(authenticatedUserId)) {
        userConnections.get(authenticatedUserId).delete(ws);
        if (userConnections.get(authenticatedUserId).size === 0) {
          userConnections.delete(authenticatedUserId);
        }
        console.log(`[WebSocket] User ${authenticatedUserId} disconnected`);
      }
    });

    ws.on("error", (err) => {
      console.error("[WebSocket] Error:", err.message);
    });
  });

  console.log("WebSocket server initialized");
};

/**
 * Send a JSON payload to all WebSocket connections belonging to a specific user.
 * @param {string} userId - The target user ID
 * @param {object} payload - The data to send
 */
const sendToUser = (userId, payload) => {
  const connections = userConnections.get(userId);
  if (!connections || connections.size === 0) return;

  const message = JSON.stringify(payload);
  for (const ws of connections) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
};

module.exports = { initWebSocket, sendToUser };
