/**
 * Pure rules for agreement cancellation and deletion.
 * Kept free of Prisma/Redis so they can be unit tested in isolation.
 */

const DELETABLE_UNSIGNED_STATUSES = ["DRAFT", "PENDING_SIGNATURE"];
const DELETABLE_TERMINAL_STATUSES = ["CANCELLED", "EXPIRED"];

/**
 * Parties to an agreement are the project owner plus everyone who has signed it.
 * Collaborators who never signed have not agreed to anything, so their consent
 * is not needed to cancel.
 *
 * @param {{ project: { ownerId: string }, signatures: { userId: string }[] }} agreement
 * @returns {string[]}
 */
const getAgreementPartyIds = (agreement) => {
  const ids = new Set([agreement.project.ownerId, ...agreement.signatures.map((s) => s.userId)]);
  return [...ids];
};

/**
 * @param {string[]} partyIds
 * @param {string[]} approvals
 * @returns {string[]} Parties who have not yet consented to the cancellation
 */
const getPendingCancellationPartyIds = (partyIds, approvals = []) => {
  const approved = new Set(approvals);
  return partyIds.filter((id) => !approved.has(id));
};

const isCancellationPending = (agreement) =>
  agreement.status !== "CANCELLED" && Boolean(agreement.cancellationRequestedAt);

/**
 * Returns the reason an agreement cannot be deleted, or null when deletion is allowed.
 *
 * @param {{ status: string, signatures: object[], escrows: object[] }} agreement
 * @returns {string|null}
 */
const getAgreementDeletionBlocker = (agreement) => {
  if (agreement.escrows.length > 0) {
    return "This agreement backs the project's escrow and cannot be deleted.";
  }

  if (DELETABLE_TERMINAL_STATUSES.includes(agreement.status)) return null;

  if (DELETABLE_UNSIGNED_STATUSES.includes(agreement.status) && agreement.signatures.length === 0) {
    return null;
  }

  return "This agreement has been signed. It must be cancelled with the consent of all parties before it can be deleted.";
};

/**
 * Shape the cancellation state returned to clients alongside an agreement.
 */
const buildCancellationSummary = (agreement, partyIds) => {
  if (!agreement.cancellationRequestedAt) return null;

  return {
    requestedById: agreement.cancellationRequestedById,
    requestedAt: agreement.cancellationRequestedAt,
    reason: agreement.cancellationReason,
    approvals: agreement.cancellationApprovals,
    pendingFrom: agreement.status === "CANCELLED"
      ? []
      : getPendingCancellationPartyIds(partyIds, agreement.cancellationApprovals),
    cancelledAt: agreement.cancelledAt,
  };
};

module.exports = {
  getAgreementPartyIds,
  getPendingCancellationPartyIds,
  isCancellationPending,
  getAgreementDeletionBlocker,
  buildCancellationSummary,
};
