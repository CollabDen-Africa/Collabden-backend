const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const walletService = require("../../payments/services/wallet.service");
const flutterwaveService = require("../../payments/services/flutterwave.service");

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

  // 4. Validate all collaborator IDs in milestones exist on the project
  const projectCollaboratorIds = project.collaborators
    .filter((c) => c.role === "COLLABORATOR")
    .map((c) => c.userId);

  const collaboratorRecordMap = {};
  for (const c of project.collaborators) {
    collaboratorRecordMap[c.userId] = c.id;
  }

  for (const ms of milestones) {
    for (const collabId of ms.collaboratorIds) {
      if (!projectCollaboratorIds.includes(collabId)) {
        throw new Error(`User ${collabId} is not an active collaborator on this project.`);
      }
    }
  }

  // 5. Calculate effective total cost and validate against totalAmount
  // Each collaborator on a milestone receives the FULL milestone amount.
  // Effective cost = Σ(milestone.amount × number of collaborators on that milestone)
  const effectiveTotalCost = milestones.reduce(
    (sum, ms) => sum + Number(ms.amount) * ms.collaboratorIds.length, 0
  );

  if (Math.abs(effectiveTotalCost - Number(totalAmount)) > 0.01) {
    throw new Error(
      `Total escrow amount (₦${Number(totalAmount).toLocaleString()}) must equal the effective milestone cost (₦${effectiveTotalCost.toLocaleString()}). ` +
      `Each collaborator on a milestone receives the full milestone amount. ` +
      `Breakdown: ${milestones.map((ms) => `"${ms.title}": ₦${Number(ms.amount).toLocaleString()} × ${ms.collaboratorIds.length} collaborator(s)`).join(", ")}.`
    );
  }

  // 6. Compute per-collaborator allocations from milestones
  const allocationByUser = {};
  for (const ms of milestones) {
    for (const collabId of ms.collaboratorIds) {
      allocationByUser[collabId] = (allocationByUser[collabId] || 0) + Number(ms.amount);
    }
  }

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

    // Create per-collaborator allocations (derived from milestones, used for approval tracking)
    for (const [userId, amount] of Object.entries(allocationByUser)) {
      await tx.escrowAllocation.create({
        data: {
          escrowId: newEscrow.id,
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
          escrowId: newEscrow.id,
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

module.exports = {
  configureEscrow,
  getEscrowByProject,
  approveEscrowProposal,
  fundEscrow,
  getEscrowStatus,
};
