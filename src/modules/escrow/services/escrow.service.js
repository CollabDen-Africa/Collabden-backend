const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const walletService = require("../../payments/services/wallet.service");
const flutterwaveService = require("../../payments/services/flutterwave.service");
const {
  MIN_ESCROW_AMOUNT,
  buildEscrowTerms,
  planCollaboratorRemoval,
} = require("../../../helpers/escrowTerms");

// Owners may nudge a collaborator about a pending approval at most once per window.
const ESCROW_REMINDER_COOLDOWN_HOURS = 24;

/**
 * Verify an agreement exists, belongs to the project, and is fully signed.
 */
const assertSignedProjectAgreement = async (agreementId, projectId) => {
  const agreement = await prisma.legalAgreement.findUnique({
    where: { id: agreementId },
    include: { signatures: true },
  });

  if (!agreement) {
    throw new Error("Legal agreement not found.");
  }

  if (agreement.projectId !== projectId) {
    throw new Error("The agreement does not belong to this project.");
  }

  if (agreement.status !== "SIGNED") {
    throw new Error("Escrow cannot be configured until the legal agreement is fully signed.");
  }

  return agreement;
};

/**
 * Validate milestone terms against the project's active collaborators and derive allocations.
 */
const resolveEscrowTerms = (project, milestones, totalAmount) => {
  const eligibleCollaboratorIds = project.collaborators
    .filter((c) => c.role === "COLLABORATOR")
    .map((c) => c.userId);

  const collaboratorRecordMap = {};
  for (const c of project.collaborators) {
    collaboratorRecordMap[c.userId] = c.id;
  }

  const { allocationByUser, effectiveTotalCost } = buildEscrowTerms({
    milestones,
    totalAmount,
    eligibleCollaboratorIds,
  });

  return { allocationByUser, effectiveTotalCost, collaboratorRecordMap };
};

/**
 * Create per-collaborator allocations (all PENDING approval) and milestones with
 * their collaborator links, inside an existing transaction.
 */
const createEscrowTermsRecords = async (tx, escrowId, milestones, allocationByUser, collaboratorRecordMap) => {
  // Create per-collaborator allocations (derived from milestones, used for approval tracking)
  for (const [userId, amount] of Object.entries(allocationByUser)) {
    await tx.escrowAllocation.create({
      data: {
        escrowId,
        collaboratorId: collaboratorRecordMap[userId],
        userId,
        totalAmount: amount,
        approvalStatus: "PENDING",
      },
    });
  }

  // Create milestones with their collaborator links
  for (const ms of milestones) {
    const milestone = await tx.escrowMilestone.create({
      data: {
        escrowId,
        title: ms.title,
        description: ms.description || null,
        amount: ms.amount,
        dueDate: ms.dueDate ? new Date(ms.dueDate) : null,
        status: "PENDING",
      },
    });

    // Create MilestoneCollaborator junction records
    for (const collabId of ms.collaboratorIds) {
      await tx.milestoneCollaborator.create({
        data: {
          milestoneId: milestone.id,
          userId: collabId,
        },
      });
    }
  }
};

/**
 * Load a project's escrow for an owner-only review action and enforce the
 * shared preconditions: owner, escrow exists, still awaiting funding.
 */
const getOwnerEscrowForReview = async (projectId, ownerId, include = {}) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      name: true,
      isDeleted: true,
      collaborators: { where: { isActive: true }, select: { id: true, userId: true, role: true } },
    },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  if (project.ownerId !== ownerId) {
    throw new Error("Only the project owner can manage the escrow proposal.");
  }

  const escrow = await prisma.escrow.findUnique({ where: { projectId }, include });

  if (!escrow) {
    throw new Error("No escrow configuration found for this project.");
  }

  if (escrow.status !== "PENDING_FUNDING") {
    throw new Error("The escrow proposal can only be changed before funding.");
  }

  return { project, escrow };
};

/**
 * Configure a new escrow for a project.
 * Validates: signed agreement exists, collaborators are active on the project,
 * and totalAmount covers all milestone costs (milestone.amount × collaborator count per milestone).
 *
 * Allocations are derived from milestones — each collaborator's total allocation
 * equals the sum of amounts across all milestones they are assigned to.
 *
 * @param {string} projectId - The project ID
 * @param {string} ownerId - The project owner's user ID
 * @param {object} data - Escrow configuration data
 * @returns {object} The created Escrow with allocations and milestones
 */
const configureEscrow = async (projectId, ownerId, data) => {
  const { totalAmount, agreementId, reviewPeriodDays, milestones } = data;

  // 1. Verify project exists and requester is owner
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      collaborators: { where: { isActive: true } },
      escrow: true,
    },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  if (project.ownerId !== ownerId) {
    throw new Error("Only the project owner can configure escrow payments.");
  }

  // 2. Prevent duplicate escrow
  if (project.escrow) {
    throw new Error("An escrow configuration already exists for this project.");
  }

  // 3. Verify the agreement exists, is SIGNED, and belongs to this project
  await assertSignedProjectAgreement(agreementId, projectId);

  // 4-6. Validate collaborators and milestone cost, derive per-collaborator allocations
  const { allocationByUser, effectiveTotalCost, collaboratorRecordMap } = resolveEscrowTerms(
    project,
    milestones,
    totalAmount
  );

  // 7. Create escrow with allocations, milestones, and collaborator links in a single transaction
  const escrow = await prisma.$transaction(async (tx) => {
    const newEscrow = await tx.escrow.create({
      data: {
        projectId,
        agreementId,
        totalAmount,
        reviewPeriodDays: reviewPeriodDays || 7,
        status: "PENDING_FUNDING",
      },
    });

    await createEscrowTermsRecords(tx, newEscrow.id, milestones, allocationByUser, collaboratorRecordMap);

    // Create activity log
    await tx.escrowActivity.create({
      data: {
        escrowId: newEscrow.id,
        userId: ownerId,
        action: "ESCROW_CONFIGURED",
        details: `Escrow configured with ₦${Number(totalAmount).toLocaleString()} across ${milestones.length} milestone(s) for ${Object.keys(allocationByUser).length} collaborator(s). Effective cost accounts for multi-collaborator milestones.`,
        metadata: { totalAmount, effectiveTotalCost, reviewPeriodDays: reviewPeriodDays || 7 },
      },
    });

    // Create project activity log
    await tx.activityLog.create({
      data: {
        projectId,
        action: "ESCROW_CONFIGURED",
        details: `Escrow payment structure configured: ₦${Number(totalAmount).toLocaleString()} with ${milestones.length} milestones.`,
      },
    });

    return newEscrow;
  });

  // 8. Fetch the full escrow with relations
  const fullEscrow = await getEscrowByProject(projectId, ownerId);

  // 9. Publish events to notify each collaborator
  for (const [userId, amount] of Object.entries(allocationByUser)) {
    await publishEvent(EVENT_TYPES.ESCROW_PROPOSAL_CREATED, {
      escrowId: escrow.id,
      projectId,
      projectName: project.name,
      collaboratorId: userId,
      amount,
      totalAmount,
    });
  }

  return fullEscrow;
};

/**
 * Get the full escrow details for a project.
 * Accessible to project owners and active collaborators.
 *
 * @param {string} projectId - The project ID
 * @param {string} userId - The requesting user's ID
 * @returns {object} Full escrow details with allocations, milestones, and activities
 */
const getEscrowByProject = async (projectId, userId) => {
  // Verify project access
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      collaborators: { where: { isActive: true } },
    },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  const isOwner = project.ownerId === userId;
  const isCollaborator = project.collaborators.some((c) => c.userId === userId);

  if (!isOwner && !isCollaborator) {
    throw new Error("Access denied.");
  }

  const escrow = await prisma.escrow.findUnique({
    where: { projectId },
    include: {
      allocations: {
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
          },
        },
      },
      milestones: {
        orderBy: { createdAt: "asc" },
        include: {
          collaborators: {
            include: {
              user: {
                select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
              },
            },
          },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
          },
        },
      },
      agreement: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  if (!escrow) {
    throw new Error("No escrow configuration found for this project.");
  }

  return escrow;
};

/**
 * Collaborator approves, requests changes, or rejects the escrow proposal.
 *
 * @param {string} projectId - The project ID
 * @param {string} userId - The collaborator's user ID
 * @param {object} data - { status, comment? }
 * @returns {object} Updated allocation record
 */
const approveEscrowProposal = async (projectId, userId, data) => {
  const { status, comment } = data;

  const escrow = await prisma.escrow.findUnique({
    where: { projectId },
    include: {
      allocations: true,
    },
  });

  if (!escrow) {
    throw new Error("No escrow configuration found for this project.");
  }

  if (escrow.status !== "PENDING_FUNDING") {
    throw new Error("Escrow proposal can only be reviewed before funding.");
  }

  // Find this user's allocation
  const allocation = escrow.allocations.find((a) => a.userId === userId);
  if (!allocation) {
    throw new Error("You do not have an escrow allocation for this project.");
  }

  if (allocation.approvalStatus === "APPROVED") {
    throw new Error("You have already approved this escrow proposal.");
  }

  // Update the allocation approval status
  const updatedAllocation = await prisma.escrowAllocation.update({
    where: { id: allocation.id },
    data: {
      approvalStatus: status,
      approvalComment: comment || null,
      approvedAt: status === "APPROVED" ? new Date() : null,
    },
  });

  // Log the activity
  await prisma.escrowActivity.create({
    data: {
      escrowId: escrow.id,
      userId,
      action: `ESCROW_PROPOSAL_${status}`,
      details: `Collaborator ${status.toLowerCase().replace("_", " ")} the escrow proposal.${comment ? ` Comment: ${comment}` : ""}`,
      metadata: { status, comment },
    },
  });

  // Publish event
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, name: true },
  });

  await publishEvent(EVENT_TYPES.ESCROW_PROPOSAL_APPROVED, {
    escrowId: escrow.id,
    projectId,
    projectName: project.name,
    collaboratorId: userId,
    ownerId: project.ownerId,
    status,
    comment,
  });

  return updatedAllocation;
};

/**
 * Fund the escrow by debiting the owner's wallet.
 * Only the project owner can fund the escrow.
 * All collaborators must have approved the proposal before funding can proceed.
 *
 * @param {string} projectId - The project ID
 * @param {string} ownerId - The project owner's user ID
 * @returns {object} Updated escrow with funding status
 */
const fundEscrow = async (projectId, ownerId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, name: true, isDeleted: true },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  if (project.ownerId !== ownerId) {
    throw new Error("Only the project owner can fund the escrow.");
  }

  const escrow = await prisma.escrow.findUnique({
    where: { projectId },
    include: { allocations: true },
  });

  if (!escrow) {
    throw new Error("No escrow configuration found for this project.");
  }

  if (escrow.status !== "PENDING_FUNDING") {
    throw new Error(`Escrow cannot be funded. Current status: ${escrow.status}.`);
  }

  // Verify all collaborators have approved
  const pendingApprovals = escrow.allocations.filter((a) => a.approvalStatus !== "APPROVED");
  if (pendingApprovals.length > 0) {
    throw new Error(
      `Cannot fund escrow. ${pendingApprovals.length} collaborator(s) have not yet approved the escrow proposal.`
    );
  }

  // Debit the owner's wallet
  const reference = flutterwaveService.generateTxRef("ESCROW");
  const amount = Number(escrow.totalAmount);

  const { transaction, wallet } = await walletService.debitWallet(
    ownerId,
    amount,
    "ESCROW_DEBIT",
    reference,
    `Escrow funding for project "${project.name}"`,
    { escrowId: escrow.id, projectId }
  );

  // Update escrow status to LOCKED
  const updatedEscrow = await prisma.escrow.update({
    where: { id: escrow.id },
    data: {
      status: "LOCKED",
      fundedAmount: amount,
      fundingReference: reference,
    },
  });

  // Log activity
  await prisma.escrowActivity.create({
    data: {
      escrowId: escrow.id,
      userId: ownerId,
      action: "ESCROW_FUNDED",
      details: `Escrow funded with ₦${amount.toLocaleString()} from wallet. Status set to LOCKED.`,
      metadata: { amount, reference, walletBalance: wallet.balance },
    },
  });

  // Project activity log
  await prisma.activityLog.create({
    data: {
      projectId,
      action: "ESCROW_FUNDED",
      details: `Escrow funded: ₦${amount.toLocaleString()} locked for collaborator payments.`,
    },
  });

  // Notify all collaborators
  for (const alloc of escrow.allocations) {
    await publishEvent(EVENT_TYPES.ESCROW_FUNDED, {
      escrowId: escrow.id,
      projectId,
      projectName: project.name,
      collaboratorId: alloc.userId,
      totalAmount: amount,
      allocationAmount: Number(alloc.totalAmount),
    });
  }

  return updatedEscrow;
};

/**
 * Get escrow status dashboard data.
 *
 * @param {string} projectId - The project ID
 * @param {string} userId - The requesting user's ID
 * @returns {object} Status summary with milestone progress and financial breakdown
 */
const getEscrowStatus = async (projectId, userId) => {
  const escrow = await getEscrowByProject(projectId, userId);

  const milestoneStats = {
    total: escrow.milestones.length,
    pending: escrow.milestones.filter((m) => m.status === "PENDING").length,
    inProgress: escrow.milestones.filter((m) => m.status === "IN_PROGRESS").length,
    submitted: escrow.milestones.filter((m) => ["SUBMITTED", "AWAITING_REVIEW"].includes(m.status)).length,
    approved: escrow.milestones.filter((m) => m.status === "APPROVED").length,
    released: escrow.milestones.filter((m) => m.status === "PAYMENT_RELEASED").length,
    disputed: escrow.milestones.filter((m) => m.status === "DISPUTED").length,
  };

  return {
    escrowId: escrow.id,
    status: escrow.status,
    totalAmount: escrow.totalAmount,
    fundedAmount: escrow.fundedAmount,
    releasedAmount: escrow.releasedAmount,
    remainingAmount: Number(escrow.fundedAmount) - Number(escrow.releasedAmount),
    reviewPeriodDays: escrow.reviewPeriodDays,
    milestoneStats,
    allocations: escrow.allocations.map((a) => ({
      user: a.user,
      totalAmount: a.totalAmount,
      releasedAmount: a.releasedAmount,
      remainingAmount: Number(a.totalAmount) - Number(a.releasedAmount),
      approvalStatus: a.approvalStatus,
    })),
    agreement: escrow.agreement,
  };
};

/**
 * Replace the escrow terms (milestones, amounts, review period, agreement) before funding.
 * Any change to the terms resets every collaborator's approval to PENDING, so
 * collaborators always approve the terms that will actually be funded.
 *
 * @param {string} projectId - The project ID
 * @param {string} ownerId - The project owner's user ID
 * @param {object} data - { totalAmount, milestones, reviewPeriodDays?, agreementId? }
 * @returns {object} The updated escrow with allocations and milestones
 */
const updateEscrowTerms = async (projectId, ownerId, data) => {
  const { totalAmount, agreementId, reviewPeriodDays, milestones } = data;

  const { project, escrow } = await getOwnerEscrowForReview(projectId, ownerId, { allocations: true });

  if (agreementId && agreementId !== escrow.agreementId) {
    await assertSignedProjectAgreement(agreementId, projectId);
  }

  const { allocationByUser, effectiveTotalCost, collaboratorRecordMap } = resolveEscrowTerms(
    project,
    milestones,
    totalAmount
  );

  const nextReviewPeriodDays = reviewPeriodDays ?? escrow.reviewPeriodDays;
  const removedUserIds = escrow.allocations
    .map((a) => a.userId)
    .filter((userId) => !(userId in allocationByUser));
  const approvalsReset = escrow.allocations.filter((a) => a.approvalStatus !== "PENDING").length;

  await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction so terms can't change under a concurrent funding.
    const { count } = await tx.escrow.updateMany({
      where: { id: escrow.id, status: "PENDING_FUNDING" },
      data: {
        totalAmount,
        reviewPeriodDays: nextReviewPeriodDays,
        agreementId: agreementId || escrow.agreementId,
      },
    });
    if (count === 0) {
      throw new Error("The escrow proposal can only be changed before funding.");
    }

    // Milestones are all PENDING before funding, so they can be rebuilt from scratch.
    await tx.escrowMilestone.deleteMany({ where: { escrowId: escrow.id } });
    await tx.escrowAllocation.deleteMany({ where: { escrowId: escrow.id } });
    await createEscrowTermsRecords(tx, escrow.id, milestones, allocationByUser, collaboratorRecordMap);

    await tx.escrowActivity.create({
      data: {
        escrowId: escrow.id,
        userId: ownerId,
        action: "ESCROW_TERMS_UPDATED",
        details: `Escrow terms updated to ₦${Number(totalAmount).toLocaleString()} across ${milestones.length} milestone(s) for ${Object.keys(allocationByUser).length} collaborator(s). All collaborator approvals were reset.`,
        metadata: {
          previousTotalAmount: Number(escrow.totalAmount),
          totalAmount,
          effectiveTotalCost,
          reviewPeriodDays: nextReviewPeriodDays,
          removedCollaboratorIds: removedUserIds,
          approvalsReset,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        projectId,
        action: "ESCROW_TERMS_UPDATED",
        details: `Escrow terms updated: ₦${Number(totalAmount).toLocaleString()} with ${milestones.length} milestones. Collaborators must re-approve.`,
      },
    });
  });

  const fullEscrow = await getEscrowByProject(projectId, ownerId);

  for (const [userId, amount] of Object.entries(allocationByUser)) {
    await publishEvent(EVENT_TYPES.ESCROW_TERMS_UPDATED, {
      escrowId: escrow.id,
      projectId,
      projectName: project.name,
      collaboratorId: userId,
      amount,
      totalAmount,
    });
  }

  for (const userId of removedUserIds) {
    await publishEvent(EVENT_TYPES.ESCROW_COLLABORATOR_REMOVED, {
      escrowId: escrow.id,
      projectId,
      projectName: project.name,
      collaboratorId: userId,
    });
  }

  return fullEscrow;
};

/**
 * Remind a collaborator who has not yet approved the escrow proposal.
 * Rate limited to one reminder per collaborator per ESCROW_REMINDER_COOLDOWN_HOURS.
 *
 * @param {string} projectId - The project ID
 * @param {string} ownerId - The project owner's user ID
 * @param {string} collaboratorUserId - The collaborator to remind
 * @returns {object} { collaboratorId, remindedAt, nextReminderAvailableAt }
 */
const remindEscrowCollaborator = async (projectId, ownerId, collaboratorUserId) => {
  const { project, escrow } = await getOwnerEscrowForReview(projectId, ownerId, { allocations: true });

  const allocation = escrow.allocations.find((a) => a.userId === collaboratorUserId);
  if (!allocation) {
    throw new Error("Escrow allocation not found for this collaborator.");
  }

  if (allocation.approvalStatus === "APPROVED") {
    throw new Error("This collaborator has already approved the escrow proposal.");
  }

  const cooldownMs = ESCROW_REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
  const lastReminder = await prisma.escrowActivity.findFirst({
    where: {
      escrowId: escrow.id,
      action: "ESCROW_APPROVAL_REMINDER_SENT",
      createdAt: { gte: new Date(Date.now() - cooldownMs) },
      metadata: { path: ["collaboratorId"], equals: collaboratorUserId },
    },
    orderBy: { createdAt: "desc" },
  });

  if (lastReminder) {
    const nextAvailable = new Date(lastReminder.createdAt.getTime() + cooldownMs);
    throw new Error(
      `This collaborator was already reminded in the last ${ESCROW_REMINDER_COOLDOWN_HOURS} hours. ` +
      `You can send another reminder after ${nextAvailable.toISOString()}.`
    );
  }

  const reminder = await prisma.escrowActivity.create({
    data: {
      escrowId: escrow.id,
      userId: ownerId,
      action: "ESCROW_APPROVAL_REMINDER_SENT",
      details: "Owner sent a reminder to review the escrow proposal.",
      metadata: { collaboratorId: collaboratorUserId, approvalStatus: allocation.approvalStatus },
    },
  });

  await publishEvent(EVENT_TYPES.ESCROW_APPROVAL_REMINDER, {
    escrowId: escrow.id,
    projectId,
    projectName: project.name,
    collaboratorId: collaboratorUserId,
    amount: Number(allocation.totalAmount),
    totalAmount: Number(escrow.totalAmount),
  });

  return {
    collaboratorId: collaboratorUserId,
    remindedAt: reminder.createdAt,
    nextReminderAvailableAt: new Date(reminder.createdAt.getTime() + cooldownMs),
  };
};

/**
 * Remove a collaborator from the escrow proposal before funding. They stay on the project.
 * Their milestone links and allocation are dropped, milestones left with nobody
 * assigned are removed, and the escrow total is recalculated. Other collaborators'
 * allocations are unchanged, so their approvals stand.
 *
 * @param {string} projectId - The project ID
 * @param {string} ownerId - The project owner's user ID
 * @param {string} collaboratorUserId - The collaborator to remove
 * @returns {object} The updated escrow with allocations and milestones
 */
const removeEscrowCollaborator = async (projectId, ownerId, collaboratorUserId) => {
  const { project, escrow } = await getOwnerEscrowForReview(projectId, ownerId, {
    allocations: true,
    milestones: { include: { collaborators: { select: { userId: true } } } },
  });

  const allocation = escrow.allocations.find((a) => a.userId === collaboratorUserId);
  if (!allocation) {
    throw new Error("Escrow allocation not found for this collaborator.");
  }

  if (escrow.allocations.length === 1) {
    throw new Error("Cannot remove the only collaborator from the escrow proposal. An escrow needs at least one collaborator.");
  }

  const { emptiedMilestoneIds, newTotalAmount } = planCollaboratorRemoval(escrow.milestones, collaboratorUserId);

  if (newTotalAmount < MIN_ESCROW_AMOUNT) {
    throw new Error(
      `Removing this collaborator would bring the escrow total to ₦${newTotalAmount.toLocaleString()}, below the ₦${MIN_ESCROW_AMOUNT.toLocaleString()} minimum. Edit the escrow terms instead.`
    );
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.escrow.updateMany({
      where: { id: escrow.id, status: "PENDING_FUNDING" },
      data: { totalAmount: newTotalAmount },
    });
    if (count === 0) {
      throw new Error("The escrow proposal can only be changed before funding.");
    }

    await tx.milestoneCollaborator.deleteMany({
      where: { userId: collaboratorUserId, milestone: { escrowId: escrow.id } },
    });
    if (emptiedMilestoneIds.length > 0) {
      await tx.escrowMilestone.deleteMany({ where: { id: { in: emptiedMilestoneIds } } });
    }
    await tx.escrowAllocation.delete({ where: { id: allocation.id } });

    await tx.escrowActivity.create({
      data: {
        escrowId: escrow.id,
        userId: ownerId,
        action: "ESCROW_COLLABORATOR_REMOVED",
        details: `A collaborator was removed from the escrow proposal. New total: ₦${newTotalAmount.toLocaleString()}.${emptiedMilestoneIds.length ? ` ${emptiedMilestoneIds.length} milestone(s) with no remaining collaborators were removed.` : ""}`,
        metadata: {
          collaboratorId: collaboratorUserId,
          previousTotalAmount: Number(escrow.totalAmount),
          totalAmount: newTotalAmount,
          removedMilestoneIds: emptiedMilestoneIds,
        },
      },
    });

    await tx.activityLog.create({
      data: {
        projectId,
        action: "ESCROW_COLLABORATOR_REMOVED",
        details: `A collaborator was removed from the escrow proposal. New escrow total: ₦${newTotalAmount.toLocaleString()}.`,
      },
    });
  });

  await publishEvent(EVENT_TYPES.ESCROW_COLLABORATOR_REMOVED, {
    escrowId: escrow.id,
    projectId,
    projectName: project.name,
    collaboratorId: collaboratorUserId,
  });

  return getEscrowByProject(projectId, ownerId);
};

module.exports = {
  configureEscrow,
  getEscrowByProject,
  approveEscrowProposal,
  fundEscrow,
  getEscrowStatus,
  updateEscrowTerms,
  remindEscrowCollaborator,
  removeEscrowCollaborator,
};
