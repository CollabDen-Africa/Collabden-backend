const EVENT_TYPES = require("../eventTypes");
const { createNotification } = require("../../modules/notifications/services/notification.service");
const { sendToUser } = require("../../config/websocket");

/**
 * Register all escrow-related event listeners on the Redis subscriber.
 * @param {import("ioredis").Redis} subscriberClient
 */
const registerEscrowListeners = (subscriberClient) => {
  // Subscribe to escrow-related channels
  subscriberClient.subscribe(
    EVENT_TYPES.ESCROW_PROPOSAL_CREATED,
    EVENT_TYPES.ESCROW_PROPOSAL_APPROVED,
    EVENT_TYPES.ESCROW_FUNDED,
    EVENT_TYPES.MILESTONE_SUBMITTED,
    EVENT_TYPES.MILESTONE_APPROVED,
    EVENT_TYPES.MILESTONE_DISPUTED,
    EVENT_TYPES.ESCROW_PAYMENT_RELEASED,
    EVENT_TYPES.ESCROW_AUTO_RELEASED,
    (err) => {
      if (err) {
        console.error("[Subscriber] Failed to subscribe to escrow events:", err.message);
      }
    }
  );

  subscriberClient.on("message", async (channel, message) => {
    try {
      const payload = JSON.parse(message);

      switch (channel) {
        case EVENT_TYPES.ESCROW_PROPOSAL_CREATED:
          await handleEscrowProposalCreated(payload);
          break;

        case EVENT_TYPES.ESCROW_PROPOSAL_APPROVED:
          await handleEscrowProposalApproved(payload);
          break;

        case EVENT_TYPES.ESCROW_FUNDED:
          await handleEscrowFunded(payload);
          break;

        case EVENT_TYPES.MILESTONE_SUBMITTED:
          await handleMilestoneSubmitted(payload);
          break;

        case EVENT_TYPES.MILESTONE_APPROVED:
          await handleMilestoneApproved(payload);
          break;

        case EVENT_TYPES.MILESTONE_DISPUTED:
          await handleMilestoneDisputed(payload);
          break;

        case EVENT_TYPES.ESCROW_PAYMENT_RELEASED:
          await handleEscrowPaymentReleased(payload);
          break;

        case EVENT_TYPES.ESCROW_AUTO_RELEASED:
          await handleEscrowAutoReleased(payload);
          break;
      }
    } catch (error) {
      console.error(`[Escrow Listener Error] ${channel}:`, error.message);
    }
  });
};

/**
 * Handle ESCROW_PROPOSAL_CREATED:
 * - Notify each collaborator that an escrow proposal was created for their project.
 */
const handleEscrowProposalCreated = async ({ projectName, collaboratorId, amount, totalAmount }) => {
  console.log(`[Listener] Processing ESCROW_PROPOSAL_CREATED for user ${collaboratorId}`);

  const notification = await createNotification({
    userId: collaboratorId,
    title: "Escrow Proposal Created",
    message: `An escrow payment proposal of ₦${Number(totalAmount).toLocaleString()} has been created for project "${projectName}". Your allocation: ₦${Number(amount).toLocaleString()}. Please review and approve.`,
    type: "ESCROW_PROPOSAL_CREATED",
    link: `/projects/${collaboratorId}/escrow`,
  });

  sendToUser(collaboratorId, { type: "NOTIFICATION", data: notification });
  sendToUser(collaboratorId, { type: "ESCROW_PROPOSAL_CREATED", data: { projectName, amount, totalAmount } });
};

/**
 * Handle ESCROW_PROPOSAL_APPROVED:
 * - Notify the project owner about a collaborator's response to the escrow proposal.
 */
const handleEscrowProposalApproved = async ({ projectName, ownerId, collaboratorId, status, comment }) => {
  console.log(`[Listener] Processing ESCROW_PROPOSAL_APPROVED for owner ${ownerId}`);

  const statusText = status.toLowerCase().replace("_", " ");

  const notification = await createNotification({
    userId: ownerId,
    title: "Escrow Proposal Response",
    message: `A collaborator has ${statusText} the escrow proposal for project "${projectName}".${comment ? ` Comment: ${comment}` : ""}`,
    type: "ESCROW_APPROVED",
    link: `/projects/${ownerId}/escrow`,
  });

  sendToUser(ownerId, { type: "NOTIFICATION", data: notification });
  sendToUser(ownerId, { type: "ESCROW_PROPOSAL_RESPONSE", data: { collaboratorId, status, comment } });
};

/**
 * Handle ESCROW_FUNDED:
 * - Notify each collaborator that the escrow has been funded and locked.
 */
const handleEscrowFunded = async ({ projectName, collaboratorId, totalAmount, allocationAmount }) => {
  console.log(`[Listener] Processing ESCROW_FUNDED for user ${collaboratorId}`);

  const notification = await createNotification({
    userId: collaboratorId,
    title: "Escrow Funded & Locked",
    message: `The escrow for project "${projectName}" has been funded with ₦${Number(totalAmount).toLocaleString()} and is now locked. Your allocation: ₦${Number(allocationAmount).toLocaleString()}.`,
    type: "ESCROW_FUNDED",
    link: `/projects/${collaboratorId}/escrow`,
  });

  sendToUser(collaboratorId, { type: "NOTIFICATION", data: notification });
  sendToUser(collaboratorId, { type: "ESCROW_FUNDED", data: { projectName, totalAmount, allocationAmount } });
};

/**
 * Handle MILESTONE_SUBMITTED:
 * - Notify the project owner that a milestone has been submitted for review.
 */
const handleMilestoneSubmitted = async ({ milestoneTitle, projectName, ownerId, collaboratorName, amount, reviewDeadline }) => {
  console.log(`[Listener] Processing MILESTONE_SUBMITTED for owner ${ownerId}`);

  const notification = await createNotification({
    userId: ownerId,
    title: "Milestone Submitted for Review",
    message: `${collaboratorName} submitted milestone "${milestoneTitle}" (₦${Number(amount).toLocaleString()}) for project "${projectName}". Review deadline: ${new Date(reviewDeadline).toLocaleDateString()}.`,
    type: "MILESTONE_SUBMITTED",
    link: `/projects/${ownerId}/escrow`,
  });

  sendToUser(ownerId, { type: "NOTIFICATION", data: notification });
  sendToUser(ownerId, { type: "MILESTONE_SUBMITTED", data: { milestoneTitle, collaboratorName, amount, reviewDeadline } });
};

/**
 * Handle MILESTONE_APPROVED:
 * - Notify the collaborator that their milestone was approved (manual approval path).
 */
const handleMilestoneApproved = async ({ milestoneTitle, projectName, collaboratorId, amount }) => {
  console.log(`[Listener] Processing MILESTONE_APPROVED for user ${collaboratorId}`);

  const notification = await createNotification({
    userId: collaboratorId,
    title: "Milestone Approved",
    message: `Your milestone "${milestoneTitle}" for project "${projectName}" has been approved. ₦${Number(amount).toLocaleString()} will be released to your wallet.`,
    type: "MILESTONE_APPROVED",
    link: `/projects/${collaboratorId}/escrow`,
  });

  sendToUser(collaboratorId, { type: "NOTIFICATION", data: notification });
};

/**
 * Handle MILESTONE_DISPUTED:
 * - Notify the affected party about a dispute raised on a milestone.
 */
const handleMilestoneDisputed = async ({ milestoneTitle, projectName, targetUserId, reason }) => {
  console.log(`[Listener] Processing MILESTONE_DISPUTED for user ${targetUserId}`);

  const notification = await createNotification({
    userId: targetUserId,
    title: "Milestone Dispute Raised",
    message: `A dispute has been raised on milestone "${milestoneTitle}" for project "${projectName}". Reason: ${reason}`,
    type: "MILESTONE_DISPUTED",
    link: `/projects/${targetUserId}/escrow`,
  });

  sendToUser(targetUserId, { type: "NOTIFICATION", data: notification });
  sendToUser(targetUserId, { type: "MILESTONE_DISPUTED", data: { milestoneTitle, reason } });
};

/**
 * Handle ESCROW_PAYMENT_RELEASED:
 * - Notify the collaborator that an escrow payment has been credited to their wallet.
 */
const handleEscrowPaymentReleased = async ({ milestoneTitle, projectName, collaboratorId, amount, paymentReference, newWalletBalance }) => {
  console.log(`[Listener] Processing ESCROW_PAYMENT_RELEASED for user ${collaboratorId}`);

  const notification = await createNotification({
    userId: collaboratorId,
    title: "Escrow Payment Released",
    message: `₦${Number(amount).toLocaleString()} has been credited to your wallet for milestone "${milestoneTitle}" on project "${projectName}". Ref: ${paymentReference}.`,
    type: "ESCROW_PAYMENT_RELEASED",
    link: `/wallet`,
  });

  sendToUser(collaboratorId, { type: "NOTIFICATION", data: notification });
  sendToUser(collaboratorId, {
    type: "WALLET_UPDATED",
    data: { balance: newWalletBalance, reference: paymentReference },
  });
};

/**
 * Handle ESCROW_AUTO_RELEASED:
 * - Notify the collaborator that their payment was auto-released due to review deadline expiry.
 * - Notify the project owner that an auto-release occurred.
 */
const handleEscrowAutoReleased = async ({ milestoneTitle, projectName, collaboratorId, amount, paymentReference, newWalletBalance, projectId }) => {
  console.log(`[Listener] Processing ESCROW_AUTO_RELEASED for user ${collaboratorId}`);

  // Notify collaborator
  const collabNotification = await createNotification({
    userId: collaboratorId,
    title: "Escrow Auto-Released",
    message: `₦${Number(amount).toLocaleString()} has been automatically released for milestone "${milestoneTitle}" on project "${projectName}" (review deadline expired). Ref: ${paymentReference}.`,
    type: "ESCROW_AUTO_RELEASED",
    link: `/wallet`,
  });

  sendToUser(collaboratorId, { type: "NOTIFICATION", data: collabNotification });
  sendToUser(collaboratorId, {
    type: "WALLET_UPDATED",
    data: { balance: newWalletBalance, reference: paymentReference },
  });
};

module.exports = { registerEscrowListeners };
