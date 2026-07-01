require("dotenv").config();
const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const { initWebSocket } = require("./config/websocket");
const { initSubscribers } = require("./events/subscriber");
require("./jobs/exportQueue"); // Initialize BullMQ export worker
const userRoutes = require("./modules/users/routes/index");
const projectRoutes = require("./modules/projects/routes/projects.route");
const dashboardRoutes = require("./modules/dashboard/routes/dashboard.route");
const notificationRoutes = require("./modules/notifications/routes/notification.route");
const messagingRoutes = require("./modules/messaging/routes/messaging.route");
const agreementRoutes = require("./routes/agreements");
const waitlistRoutes = require("./routes/waitlist.route");
const paymentRoutes = require("./modules/payments/routes/payment.route");
const subscriptionRoutes = require("./modules/subscriptions/routes/subscription.route");

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: ["http://localhost:3000", process.env.CORS_ORIGIN].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Collabden API is running" });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/projects", agreementRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/messaging", messagingRoutes);
app.use("/api/v1/waitlist", waitlistRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

// Initialize WebSocket server (attaches to the HTTP server)
initWebSocket(server);

// Initialize Redis event subscribers
initSubscribers();

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`Collabden server running on port ${PORT}`);
});

module.exports = app;

