const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const flutterwaveService = require("../../payments/services/flutterwave.service");

/**
 * Release escrow payment for an approved milestone to ALL linked collaborators.
 * Each collaborator on the milestone receives the FULL milestone amount.
 * Credits each collaborator's wallet and updates escrow/allocation balances atomically.
 * Prevents duplicate releases via payment reference uniqueness on MilestoneCollaborator.
 *
 * @param {object} milestone - Full milestone object with escrow and collaborators relations
 * @param {string} projectName - The project name for descriptions
 * @param {boolean} isAutoReleased - Whether this was triggered by auto-release
 * @returns {object} { milestone, payments[], totalReleased }
 */
const releaseMilestonePayment = async (milestone, projectName, isAutoReleased = false) => {
  // Prevent duplicate releases
  if (milestone.status === "PAYMENT_RELEASED") {
    throw new Error("Payment has already been released for this milestone.");
  }

  const collaborators = milestone.collaborators || [];
  if (collaborators.length === 0) {
    throw new Error("No collaborators linked to this milestone.");
  }

  // Check for already-released collaborators (partial release protection)
  const alreadyReleased = collaborators.filter((mc) => mc.paymentReference !== null);
  if (alreadyReleased.length > 0) {
    throw new Error("Some collaborators on this milestone have already been paid. Possible duplicate release.");
  }

  const amount = Number(milestone.amount);
  const totalReleaseAmount = amount * collaborators.length;

  // Verify escrow has sufficient remaining balance
  const escrow = await prisma.escrow.findUnique({ where: { id: milestone.escrowId } });
  const remainingBalance = Number(escrow.fundedAmount) - Number(escrow.releasedAmount);
  if (totalReleaseAmount > remainingBalance + 0.01) {
    throw new Error(
      `Insufficient escrow balance. Release requires ₦${totalReleaseAmount.toLocaleString()} but only ₦${remainingBalance.toLocaleString()} remains.`
    );
  }

  // Atomic transaction: credit all collaborator wallets + update balances + update milestone
  const result = await prisma.$transaction(async (tx) => {
    const payments = [];

    for (const mc of collaborators) {
      const collaboratorUserId = mc.userId;
      const paymentReference = flutterwaveService.generateTxRef("ESCROW-REL");

      // 1. Get or create the collaborator's wallet
      let wallet = await tx.wallet.findUnique({ where: { userId: collaboratorUserId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId: collaboratorUserId, balance: 0, currency: "NGN" },
        });
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = Number(balanceBefore) + amount;

      // 2. Credit the wallet
      const updatedWallet = await tx.wallet.update({
        where: { userId: collaboratorUserId },
        data: { balance: balanceAfter },
      });

      // 3. Create the transaction record
      const transaction = await tx.transaction.create({
        data: {
          userId: collaboratorUserId,
          type: "ESCROW_CREDIT",
          status: "COMPLETED",
          amount,
          balanceBefore,
          balanceAfter,
          reference: paymentReference,
          description: `Escrow payment for milestone "${milestone.title}" — ${projectName}`,
          metadata: {
            escrowId: milestone.escrowId,
            milestoneId: milestone.id,
            projectName,
            isAutoReleased,
          },
        },
      });

      // 4. Update the MilestoneCollaborator record
      await tx.milestoneCollaborator.update({
        where: { id: mc.id },
        data: {
          paymentReference,
          releasedAt: new Date(),
        },
      });

      // 5. Update allocation released amount
      const allocation = await tx.escrowAllocation.findUnique({
        where: {
          escrowId_userId: {
            escrowId: milestone.escrowId,
            userId: collaboratorUserId,
          },
        },
      });

      if (allocation) {
        await tx.escrowAllocation.update({
          where: { id: allocation.id },
          data: {
            releasedAmount: { increment: amount },
          },
        });
      }

      payments.push({
        collaboratorId: collaboratorUserId,
        amount,
        paymentReference,
        transaction,
        newBalance: updatedWallet.balance,
      });
    }

    // 6. Update milestone status to PAYMENT_RELEASED
    await tx.escrowMilestone.update({
      where: { id: milestone.id },
      data: {
        status: "PAYMENT_RELEASED",
        approvedAt: new Date(),
        isAutoReleased,
      },
    });

    // 7. Update escrow released amount (amount × number of collaborators)
    await tx.escrow.update({
      where: { id: milestone.escrowId },
      data: {
        releasedAmount: { increment: totalReleaseAmount },
      },
    });

    return payments;
  });

  // Check if all milestones are now released → mark escrow as COMPLETED
  const allMilestones = await prisma.escrowMilestone.findMany({
    where: { escrowId: milestone.escrowId },
  });

  const allReleased = allMilestones.every((m) => m.status === "PAYMENT_RELEASED");
  if (allReleased) {
    await prisma.escrow.update({
      where: { id: milestone.escrowId },
      data: { status: "COMPLETED" },
    });

    await prisma.activityLog.create({
      data: {
        projectId: milestone.escrow.projectId,
        action: "ESCROW_COMPLETED",
        details: "All milestones released. Escrow marked as completed.",
      },
    });
  }

  // Publish events for each collaborator
  const eventType = isAutoReleased
    ? EVENT_TYPES.ESCROW_AUTO_RELEASED
    : EVENT_TYPES.ESCROW_PAYMENT_RELEASED;

  for (const payment of result) {
    await publishEvent(eventType, {
      escrowId: milestone.escrowId,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      projectId: milestone.escrow.projectId,
      projectName,
      collaboratorId: payment.collaboratorId,
      amount: payment.amount,
      paymentReference: payment.paymentReference,
      isAutoReleased,
      newWalletBalance: payment.newBalance,
    });
  }

  return {
    milestone: {
      id: milestone.id,
      title: milestone.title,
      amountPerCollaborator: amount,
      totalReleased: totalReleaseAmount,
      collaboratorCount: collaborators.length,
      status: "PAYMENT_RELEASED",
      isAutoReleased,
    },
    payments: result.map((p) => ({
      collaboratorId: p.collaboratorId,
      amount: p.amount,
      paymentReference: p.paymentReference,
    })),
    totalReleased: totalReleaseAmount,
  };
};

/**
 * Get project payment history — all escrow payments for a project.
 *
 * @param {string} projectId - The project ID
 * @param {string} userId - The requesting user's ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {object} { payments, pagination }
 */
const getProjectPaymentHistory = async (projectId, userId, page = 1, limit = 20) => {
  // Verify project access
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { collaborators: { where: { isActive: true } } },
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
  });

  if (!escrow) {
    return { payments: [], pagination: { page, limit, total: 0, totalPages: 0 } };
  }

  // Get all released MilestoneCollaborator records
  const skip = (page - 1) * limit;

  const [released, total] = await Promise.all([
    prisma.milestoneCollaborator.findMany({
      where: {
        milestone: { escrowId: escrow.id },
        paymentReference: { not: null },
      },
      include: {
        milestone: {
          select: { id: true, title: true, amount: true, isAutoReleased: true },
        },
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
        },
      },
      orderBy: { releasedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.milestoneCollaborator.count({
      where: {
        milestone: { escrowId: escrow.id },
        paymentReference: { not: null },
      },
    }),
  ]);

  const payments = released.map((mc) => ({
    milestoneId: mc.milestone.id,
    milestoneTitle: mc.milestone.title,
    amount: mc.milestone.amount,
    collaborator: mc.user,
    paymentReference: mc.paymentReference,
    isAutoReleased: mc.milestone.isAutoReleased,
    releasedAt: mc.releasedAt,
    projectId,
    projectName: project.name,
  }));

  return {
    payments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Get all escrow payments received by a user across all projects.
 *
 * @param {string} userId - The user's ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {object} { payments, pagination }
 */
const getPersonalEscrowPayments = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const where = {
    userId,
    type: "ESCROW_CREDIT",
    status: "COMPLETED",
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    payments: transactions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

module.exports = {
  releaseMilestonePayment,
  getProjectPaymentHistory,
  getPersonalEscrowPayments,
};
