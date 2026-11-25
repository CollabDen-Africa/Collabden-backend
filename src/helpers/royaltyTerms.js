/**
 * Pure rules for royalty terms acceptance.
 * Kept free of Prisma so they can be unit tested in isolation.
 *
 * A project "has royalties" once at least one royalty split is configured.
 * From then on, every collaborator must accept their own split before they
 * can sign any agreement on the project. The owner sets the terms, so their
 * own split is accepted implicitly.
 */

const LIVE_AGREEMENT_STATUSES = ["DRAFT", "PENDING_SIGNATURE", "SIGNED"];

const projectHasRoyalties = (splits) => splits.length > 0;

/**
 * Returns the reason a user cannot sign an agreement yet, or null when they may sign.
 *
 * @param {{ splits: { userId: string, approvalStatus: string }[], userId: string, ownerId: string }} params
 * @returns {string|null}
 */
const getRoyaltySigningBlocker = ({ splits, userId, ownerId }) => {
  if (!projectHasRoyalties(splits) || userId === ownerId) return null;

  const split = splits.find((s) => s.userId === userId);
  if (!split) {
    return "This project has royalty terms, but no royalty share has been assigned to you yet. Ask the project owner to assign your share before signing.";
  }

  if (split.approvalStatus !== "ACCEPTED") {
    return "You must accept your royalty terms for this project before signing the agreement.";
  }

  return null;
};

/**
 * Collaborators (other than the owner) who still need to accept royalty terms.
 * Includes signers with no split assigned at all.
 *
 * @param {{ userId: string, approvalStatus: string }[]} splits
 * @param {string[]} requiredSignerIds Owner plus accepted, active collaborators
 * @param {string} ownerId
 * @returns {string[]}
 */
const getPendingRoyaltyAcceptanceIds = (splits, requiredSignerIds, ownerId) => {
  if (!projectHasRoyalties(splits)) return [];
  return requiredSignerIds.filter(
    (id) => getRoyaltySigningBlocker({ splits, userId: id, ownerId }) !== null
  );
};

/**
 * Validate and normalise an owner's royalty split payload.
 *
 * @param {object[]} splitsData
 * @param {string[]} eligibleUserIds Owner plus active collaborators
 * @returns {{ userId: string, royaltyShare: number, role: string|null }[]}
 */
const normalizeRoyaltySplits = (splitsData, eligibleUserIds) => {
  if (!Array.isArray(splitsData)) {
    throw badRequest("Splits must be an array of collaborator royalty allocations.");
  }

  const eligible = new Set(eligibleUserIds);
  const seen = new Set();

  const splits = splitsData.map((split) => {
    const { userId, royaltyShare, role } = split || {};
    const share = Number(royaltyShare);

    if (!userId || royaltyShare === undefined || royaltyShare === null || Number.isNaN(share)) {
      throw badRequest("Each split requires a userId and a numeric royaltyShare.");
    }
    if (share < 0 || share > 100) {
      throw badRequest("Each royalty share must be between 0 and 100.");
    }
    if (!eligible.has(userId)) {
      throw badRequest(`User ${userId} is not an active collaborator on this project.`);
    }
    if (seen.has(userId)) {
      throw badRequest(`User ${userId} appears more than once in the splits.`);
    }
    seen.add(userId);

    return { userId, royaltyShare: share, role: role || null };
  });

  const totalShare = splits.reduce((sum, s) => sum + s.royaltyShare, 0);
  if (totalShare > 100) {
    throw badRequest(`Total royalty split percentage cannot exceed 100%. Current sum: ${totalShare}%.`);
  }

  return splits;
};

/**
 * Whether an incoming split changes the terms a collaborator agreed to.
 */
const hasSplitTermsChanged = (existing, incoming) =>
  !existing ||
  Number(existing.royaltyShare) !== incoming.royaltyShare ||
  (existing.role || null) !== incoming.role;

/**
 * Royalty terms are frozen while any live agreement carries signatures:
 * changing them would contradict what people already signed.
 *
 * @param {{ status: string, signatures: object[] }[]} agreements
 * @returns {string|null}
 */
const getRoyaltyEditBlocker = (agreements) => {
  const locked = agreements.some(
    (a) => LIVE_AGREEMENT_STATUSES.includes(a.status) && a.signatures.length > 0
  );
  return locked
    ? "Royalty terms cannot be changed while an agreement on this project has signatures. Cancel the agreement first."
    : null;
};

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

module.exports = {
  LIVE_AGREEMENT_STATUSES,
  projectHasRoyalties,
  getRoyaltySigningBlocker,
  getPendingRoyaltyAcceptanceIds,
  normalizeRoyaltySplits,
  hasSplitTermsChanged,
  getRoyaltyEditBlocker,
};
