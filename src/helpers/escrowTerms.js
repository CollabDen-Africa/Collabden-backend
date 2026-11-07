/**
 * Pure escrow-terms calculations shared by escrow configuration, terms edits,
 * and collaborator removal. Kept free of Prisma/Redis so they can be unit tested.
 */

const MIN_ESCROW_AMOUNT = 1000;

/**
 * Each collaborator on a milestone receives the FULL milestone amount.
 * Effective cost = Σ(milestone.amount × number of collaborators on that milestone)
 *
 * @param {{ amount: number|string, collaboratorIds: string[] }[]} milestones
 * @returns {number}
 */
const calculateEffectiveTotalCost = (milestones) =>
  milestones.reduce((sum, ms) => sum + Number(ms.amount) * ms.collaboratorIds.length, 0);

/**
 * Validate milestone terms against the project's eligible collaborators and the
 * declared total, then derive per-collaborator allocations.
 *
 * @param {object} params
 * @param {object[]} params.milestones - [{ title, amount, collaboratorIds }]
 * @param {number} params.totalAmount
 * @param {string[]} params.eligibleCollaboratorIds - Active COLLABORATOR userIds on the project
 * @returns {{ allocationByUser: Object<string, number>, effectiveTotalCost: number }}
 */
const buildEscrowTerms = ({ milestones, totalAmount, eligibleCollaboratorIds }) => {
  for (const ms of milestones) {
    for (const collabId of ms.collaboratorIds) {
      if (!eligibleCollaboratorIds.includes(collabId)) {
        throw new Error(`User ${collabId} is not an active collaborator on this project.`);
      }
    }
  }

  const effectiveTotalCost = calculateEffectiveTotalCost(milestones);

  if (Math.abs(effectiveTotalCost - Number(totalAmount)) > 0.01) {
    throw new Error(
      `Total escrow amount (₦${Number(totalAmount).toLocaleString()}) must equal the effective milestone cost (₦${effectiveTotalCost.toLocaleString()}). ` +
      `Each collaborator on a milestone receives the full milestone amount. ` +
      `Breakdown: ${milestones.map((ms) => `"${ms.title}": ₦${Number(ms.amount).toLocaleString()} × ${ms.collaboratorIds.length} collaborator(s)`).join(", ")}.`
    );
  }

  const allocationByUser = {};
  for (const ms of milestones) {
    for (const collabId of ms.collaboratorIds) {
      allocationByUser[collabId] = (allocationByUser[collabId] || 0) + Number(ms.amount);
    }
  }

  return { allocationByUser, effectiveTotalCost };
};

/**
 * Work out what happens to an escrow's milestones when one collaborator is removed.
 *
 * @param {{ id: string, amount: number|string, collaborators: { userId: string }[] }[]} milestones
 * @param {string} userId - The collaborator being removed
 * @returns {{ emptiedMilestoneIds: string[], newTotalAmount: number }}
 */
const planCollaboratorRemoval = (milestones, userId) => {
  const remaining = milestones.map((ms) => ({
    id: ms.id,
    amount: ms.amount,
    collaboratorIds: ms.collaborators.map((c) => c.userId).filter((id) => id !== userId),
  }));

  return {
    emptiedMilestoneIds: remaining.filter((ms) => ms.collaboratorIds.length === 0).map((ms) => ms.id),
    newTotalAmount: calculateEffectiveTotalCost(remaining),
  };
};

module.exports = {
  MIN_ESCROW_AMOUNT,
  calculateEffectiveTotalCost,
  buildEscrowTerms,
  planCollaboratorRemoval,
};
