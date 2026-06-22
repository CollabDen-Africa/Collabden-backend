const EVENT_TYPES = require("../eventTypes");
const { createNotification } = require("../../modules/notifications/services/notification.service");
const { sendToUser } = require("../../config/websocket");
const { sendEmail } = require("../../utils/sendEmail");
const {
  getWalletFundedEmailTemplate,
  getWithdrawalInitiatedEmailTemplate,
  getWithdrawalCompletedEmailTemplate,
  getWithdrawalFailedEmailTemplate,
} = require("../../utils/emailTemplates");
const prisma = require("../../config/prismaClient");

/**
 * Fetch the user's email for transaction email notifications.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
const getUserEmail = async (userId) => {
  try {
    const user = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email || null;
  } catch (error) {
    console.error(`[Payment Listener] Failed to fetch email for user ${userId}:`, error.message);
    return null;
  }
};

/**
 * Send a transaction email (non-blocking). Errors are logged, not thrown,
 * so they never break the notification/WebSocket flow.
 */
const sendTransactionEmail = async (email, subject, template) => {
  if (!email) return;
  try {
    await sendEmail({
      to: email,
      subject,
      html: template.html,
      text: template.text,
    });
    console.log(`[Payment Email] Sent "${subject}" to ${email}`);
  } catch (error) {
    console.error(`[Payment Email Error] Failed to send "${subject}" to ${email}:`, error.message);
  }
};

/**
 * Register all payment-related event listeners on the Redis subscriber.
 * @param {import("ioredis").Redis} subscriberClient
 */
const registerPaymentListeners = (subscriberClient) => {
  // Subscribe to payment-related channels
  subscriberClient.subscribe(
    EVENT_TYPES.WALLET_FUNDED,
    EVENT_TYPES.WITHDRAWAL_INITIATED,
    EVENT_TYPES.WITHDRAWAL_COMPLETED,
    EVENT_TYPES.WITHDRAWAL_FAILED,
    (err) => {
      if (err) {
        console.error("[Subscriber] Failed to subscribe to payment events:", err.message);
      }
    }
  );

  subscriberClient.on("message", async (channel, message) => {
    try {
      const payload = JSON.parse(message);

      switch (channel) {
        case EVENT_TYPES.WALLET_FUNDED:
          await handleWalletFunded(payload);
          break;

        case EVENT_TYPES.WITHDRAWAL_INITIATED:
          await handleWithdrawalInitiated(payload);
          break;

        case EVENT_TYPES.WITHDRAWAL_COMPLETED:
          await handleWithdrawalCompleted(payload);
          break;

        case EVENT_TYPES.WITHDRAWAL_FAILED:
          await handleWithdrawalFailed(payload);
          break;
      }
    } catch (error) {
      console.error(`[Payment Listener Error] ${channel}:`, error.message);
    }
  });
};

/**
 * Handle WALLET_FUNDED event:
 * - Create a notification for the user
 * - Push real-time notification via WebSocket
 * - Send credit alert email
 */
const handleWalletFunded = async ({ userId, amount, newBalance, reference }) => {
  console.log(`[Listener] Processing WALLET_FUNDED for user ${userId}`);

  const notification = await createNotification({
    userId,
    title: "Wallet Funded",
    message: `Your wallet has been credited with ₦${Number(amount).toLocaleString()}. New balance: ₦${Number(newBalance).toLocaleString()}.`,
    type: "WALLET_FUNDED",
    link: "/wallet",
  });

  sendToUser(userId, {
    type: "NOTIFICATION",
    data: notification,
  });

  sendToUser(userId, {
    type: "WALLET_UPDATED",
    data: { balance: newBalance, reference },
  });

  // Send credit alert email
  const email = await getUserEmail(userId);
  const template = getWalletFundedEmailTemplate({ amount, newBalance, reference });
  await sendTransactionEmail(email, "Wallet Funded — Credit Alert", template);
};

/**
 * Handle WITHDRAWAL_INITIATED event:
 * - Notify user that withdrawal request has been submitted
 * - Send debit alert email
 */
const handleWithdrawalInitiated = async ({ userId, amount, bankName, accountNumber, reference }) => {
  console.log(`[Listener] Processing WITHDRAWAL_INITIATED for user ${userId}`);

  const notification = await createNotification({
    userId,
    title: "Withdrawal Initiated",
    message: `Your withdrawal of ₦${Number(amount).toLocaleString()} to ${bankName} (****${accountNumber.slice(-4)}) is being processed.`,
    type: "WITHDRAWAL_INITIATED",
    link: "/wallet/withdrawals",
  });

  sendToUser(userId, {
    type: "NOTIFICATION",
    data: notification,
  });

  // Send debit alert email
  const email = await getUserEmail(userId);
  const template = getWithdrawalInitiatedEmailTemplate({ amount, bankName, accountNumber, reference });
  await sendTransactionEmail(email, "Withdrawal Processing — Debit Alert", template);
};

/**
 * Handle WITHDRAWAL_COMPLETED event:
 * - Notify user that withdrawal has been completed
 * - Send completion email
 */
const handleWithdrawalCompleted = async ({ userId, amount, reference }) => {
  console.log(`[Listener] Processing WITHDRAWAL_COMPLETED for user ${userId}`);

  const notification = await createNotification({
    userId,
    title: "Withdrawal Completed",
    message: `Your withdrawal of ₦${Number(amount).toLocaleString()} has been completed successfully.`,
    type: "WITHDRAWAL_COMPLETED",
    link: "/wallet/withdrawals",
  });

  sendToUser(userId, {
    type: "NOTIFICATION",
    data: notification,
  });

  // Send completion email
  const email = await getUserEmail(userId);
  const template = getWithdrawalCompletedEmailTemplate({ amount, reference });
  await sendTransactionEmail(email, "Withdrawal Successful ✅", template);
};

/**
 * Handle WITHDRAWAL_FAILED event:
 * - Notify user that withdrawal has failed and funds were reversed
 * - Send failure/reversal email
 */
const handleWithdrawalFailed = async ({ userId, amount, reference, reason }) => {
  console.log(`[Listener] Processing WITHDRAWAL_FAILED for user ${userId}`);

  const notification = await createNotification({
    userId,
    title: "Withdrawal Failed",
    message: `Your withdrawal of ₦${Number(amount).toLocaleString()} could not be processed. ${reason || "Funds have been returned to your wallet."}`,
    type: "WITHDRAWAL_COMPLETED",
    link: "/wallet",
  });

  sendToUser(userId, {
    type: "NOTIFICATION",
    data: notification,
  });

  sendToUser(userId, {
    type: "WALLET_UPDATED",
    data: { reference },
  });

  // Send failure email
  const email = await getUserEmail(userId);
  const template = getWithdrawalFailedEmailTemplate({ amount, reference, reason });
  await sendTransactionEmail(email, "Withdrawal Failed — Funds Reversed", template);
};

module.exports = { registerPaymentListeners };
