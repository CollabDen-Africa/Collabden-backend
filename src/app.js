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
const escrowRoutes = require("./modules/escrow/routes/escrow.route");
const { initEscrowAutoRelease } = require("./jobs/escrowAutoRelease");
const subscriptionRoutes = require("./modules/subscriptions/routes/subscription.route");
const notificationSettingRoutes = require("./modules/notifications/routes/notificationSetting.route");
const adminAuthRoutes = require("./modules/admin/routes/adminAuth.route");
const adminUsersRoutes = require("./modules/admin/routes/adminUsers.route");
const adminPermissionsRoutes = require("./modules/admin/routes/adminPermissions.route");
const adminProjectsRoutes = require("./modules/admin/routes/adminProjects.route");
const adminMarketplaceRoutes = require("./modules/admin/routes/adminMarketplace.route");
const adminAgreementsRoutes = require("./modules/admin/routes/adminAgreements.route");
const adminTransactionsRoutes = require("./modules/admin/routes/adminTransactions.route");
const adminEscrowRoutes = require("./modules/admin/routes/adminEscrow.route");
const adminDisputesRoutes = require("./modules/admin/routes/adminDisputes.route");
const adminWithdrawalsRoutes = require("./modules/admin/routes/adminWithdrawals.route");
const adminPaymentReportsRoutes = require("./modules/admin/routes/adminPaymentReports.route");
const adminVerificationRoutes = require("./modules/admin/routes/adminVerification.route");
const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: ["http://localhost:3000", process.env.CORS_ORIGIN].filter(Boolean),
    credentials: true,
  })
);
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.includes("/webhook")) {
        req.rawBody = buf;
      }
    },
  })
);
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
app.use("/api/v1/notification-settings", notificationSettingRoutes);
app.use("/api/v1/messaging", messagingRoutes);
app.use("/api/v1/waitlist", waitlistRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/projects", escrowRoutes);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/admin/auth", adminAuthRoutes);
app.use("/api/v1/admin/users", adminUsersRoutes);
app.use("/api/v1/admin/permissions", adminPermissionsRoutes);
app.use("/api/v1/admin/projects", adminProjectsRoutes);
app.use("/api/v1/admin/marketplace", adminMarketplaceRoutes);
app.use("/api/v1/admin/agreements", adminAgreementsRoutes);
app.use("/api/v1/admin/transactions", adminTransactionsRoutes);
app.use("/api/v1/admin/escrow", adminEscrowRoutes);
app.use("/api/v1/admin/disputes", adminDisputesRoutes);
app.use("/api/v1/admin/finance", adminWithdrawalsRoutes);
app.use("/api/v1/admin/payments", adminPaymentReportsRoutes);
app.use("/api/v1/admin/verification", adminVerificationRoutes);

app.use((err, req, res, next) => {
  // Handle JSON parsing errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: "Invalid JSON payload format." });
  }

  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong" });
});

// Initialize WebSocket server (attaches to the HTTP server)
initWebSocket(server);

// Initialize Redis event subscribers
initSubscribers();

// Initialize escrow auto-release scheduler
initEscrowAutoRelease();

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`Collabden server running on port ${PORT}`);
});

module.exports = app;
// Trigger restart 2
