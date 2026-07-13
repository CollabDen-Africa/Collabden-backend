const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const escrowReleaseService = require("./escrowRelease.service");

/**
 * Submit a milestone with supporting evidence.
 * Any collaborator assigned to the milestone can submit it.
 * Sets status to AWAITING_REVIEW and calculates the review deadline.
 *
 * @param {string} projectId - The project ID
 * @param {string} milestoneId - The milestone ID
 * @param {string} userId - The submitting collaborator's user ID
 * @param {object} evidence - { files: [], links: [], documents: [], comment: "" }
 * @returns {object} Updated milestone
 */
const submitMilestone = async (projectId, milestoneId, userId, evidence) => {
  const milestone = await prisma.escrowMilestone.findUnique({
    where: { id: milestoneId },
    include: {
      escrow: true,
      collaborators: {
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
          },
        },
      },
    },
  });

  if (!milestone) {
    throw new Error("Milestone not found.");
  }

  if (milestone.escrow.projectId !== projectId) {
    throw new Error("Milestone does not belong to this project.");
  }

  // Verify the user is one of the assigned collaborators
  const isAssigned = milestone.collaborators.some((mc) => mc.userId === userId);
  if (!isAssigned) {
    throw new Error("Only assigned collaborators can submit this milestone.");
  }

  // Verify escrow is locked (funded)
  if (milestone.escrow.status !== "LOCKED") {
    throw new Error("Milestones can only be submitted after escrow is funded and locked.");
  }

  // Prevent duplicate submissions
  if (["SUBMITTED", "AWAITING_REVIEW", "APPROVED", "PAYMENT_RELEASED"].includes(milestone.status)) {
    throw new Error(`This milestone has already been submitted. Current status: ${milestone.status}.`);
  }

  // Calculate review deadline based on the escrow's review period
  const reviewDeadline = new Date();
  reviewDeadline.setDate(reviewDeadline.getDate() + milestone.escrow.reviewPeriodDays);

  // Update milestone
  const updatedMilestone = await prisma.escrowMilestone.update({
    where: { id: milestoneId },
    data: {
      status: "AWAITING_REVIEW",
      submittedAt: new Date(),
      reviewDeadline,
      evidence,
    },
    include: {
      collaborators: {
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
          },
        },
      },
    },
  });

  // Get the submitting user's display info
  const submitter = updatedMilestone.collaborators.find((mc) => mc.userId === userId);
  const submitterName = submitter?.user?.displayName || submitter?.user?.email || userId;

  // Log activity
  await prisma.escrowActivity.create({
    data: {
      escrowId: milestone.escrowId,
      userId,
      action: "MILESTONE_SUBMITTED",
      details: `Milestone "${milestone.title}" submitted for review by ${submitterName}. Review deadline: ${reviewDeadline.toISOString()}.`,
      metadata: { milestoneId, evidence, reviewDeadline },
    },
  });

  // Project activity log
  await prisma.activityLog.create({
    data: {
      projectId,
      action: "MILESTONE_SUBMITTED",
      details: `Milestone "${milestone.title}" submitted for review by ${submitterName}.`,
    },
  });

  // Notify the project owner
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, name: true },
  });

  await publishEvent(EVENT_TYPES.MILESTONE_SUBMITTED, {
    escrowId: milestone.escrowId,
    milestoneId,
    milestoneTitle: milestone.title,
    projectId,
    projectName: project.name,
    ownerId: project.ownerId,
    collaboratorId: userId,
    collaboratorName: submitterName,
    amount: Number(milestone.amount),
    collaboratorCount: milestone.collaborators.length,
    reviewDeadline,
  });

  return updatedMilestone;
};

/**
 * Project owner approves a submitted milestone.
 * Triggers payment release to ALL collaborators linked to the milestone.
 * Each collaborator receives the full milestone amount.
 *
 * @param {string} projectId - The project ID
 * @param {string} milestoneId - The milestone ID
 * @param {string} ownerId - The project owner's user ID
 * @returns {object} Updated milestone with payment details
 */
const approveMilestone = async (projectId, milestoneId, ownerId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, name: true, isDeleted: true },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  if (project.ownerId !== ownerId) {
    throw new Error("Only the project owner can approve milestones.");
  }

  const milestone = await prisma.escrowMilestone.findUnique({
    where: { id: milestoneId },
    include: {
      escrow: true,
      collaborators: {
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
          },
        },
      },
    },
  });

  if (!milestone) {
    throw new Error("Milestone not found.");
  }

  if (milestone.escrow.projectId !== projectId) {
    throw new Error("Milestone does not belong to this project.");
  }

  if (milestone.status !== "AWAITING_REVIEW") {
    throw new Error(`Milestone cannot be approved. Current status: ${milestone.status}.`);
  }

  // Approve and release payment to ALL collaborators
  const result = await escrowReleaseService.releaseMilestonePayment(
    milestone,
    project.name,
    false // not auto-released
  );

  // Build collaborator names for activity log
  const collabNames = milestone.collaborators
    .map((mc) => mc.user.displayName || mc.user.email)
    .join(", ");

  // Log activity
  await prisma.escrowActivity.create({
    data: {
      escrowId: milestone.escrowId,
      userId: ownerId,
      action: "MILESTONE_APPROVED",
      details: `Milestone "${milestone.title}" approved. ₦${Number(milestone.amount).toLocaleString()} released to each of ${milestone.collaborators.length} collaborator(s): ${collabNames}. Total released: ₦${result.totalReleased.toLocaleString()}.`,
      metadata: {
        milestoneId,
        amountPerCollaborator: Number(milestone.amount),
        totalReleased: result.totalReleased,
        collaboratorCount: milestone.collaborators.length,
        payments: result.payments,
      },
    },
  });

  // Project activity log
  await prisma.activityLog.create({
    data: {
      projectId,
      action: "MILESTONE_APPROVED",
      details: `Milestone "${milestone.title}" approved. ₦${result.totalReleased.toLocaleString()} released to ${milestone.collaborators.length} collaborator(s).`,
    },
  });

  return result;
};

/**
 * Raise a dispute on a milestone.
 * Can be raised by the project owner or any collaborator assigned to the milestone.
 *
 * @param {string} projectId - The project ID
 * @param {string} milestoneId - The milestone ID
 * @param {string} userId - The disputing user's ID
 * @param {string} reason - The reason for the dispute
 * @returns {object} Updated milestone
 */
const disputeMilestone = async (projectId, milestoneId, userId, reason) => {
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

  const milestone = await prisma.escrowMilestone.findUnique({
    where: { id: milestoneId },
    include: {
      escrow: true,
      collaborators: true,
    },
  });

  if (!milestone) {
    throw new Error("Milestone not found.");
  }

  if (milestone.escrow.projectId !== projectId) {
    throw new Error("Milestone does not belong to this project.");
  }

  if (!["AWAITING_REVIEW", "SUBMITTED"].includes(milestone.status)) {
    throw new Error(`Cannot dispute this milestone. Current status: ${milestone.status}.`);
  }

  // Update milestone to disputed
  const updatedMilestone = await prisma.escrowMilestone.update({
    where: { id: milestoneId },
    data: {
      status: "DISPUTED",
      disputeReason: reason,
    },
  });

  // Log activity
  await prisma.escrowActivity.create({
    data: {
      escrowId: milestone.escrowId,
      userId,
      action: "MILESTONE_DISPUTED",
      details: `Dispute raised on milestone "${milestone.title}": ${reason}`,
      metadata: { milestoneId, reason, disputedBy: userId },
    },
  });

  // Project activity log
  await prisma.activityLog.create({
    data: {
      projectId,
      action: "MILESTONE_DISPUTED",
      details: `Dispute raised on milestone "${milestone.title}".`,
    },
  });

  // Notify all relevant parties (owner + all milestone collaborators, except the disputer)
  const notifyIds = [
    project.ownerId,
    ...milestone.collaborators.map((mc) => mc.userId),
  ].filter((id, index, arr) => id !== userId && arr.indexOf(id) === index);

  for (const targetId of notifyIds) {
    await publishEvent(EVENT_TYPES.MILESTONE_DISPUTED, {
      escrowId: milestone.escrowId,
      milestoneId,
      milestoneTitle: milestone.title,
      projectId,
      projectName: project.name,
      targetUserId: targetId,
      disputedBy: userId,
      reason,
    });
  }

  return updatedMilestone;
};

/**
 * Admin resolves a dispute on a milestone.
 * If approved, triggers payment release to all collaborators.
 * If rejected, sets milestone back to PENDING.
 *
 * @param {string} milestoneId - The milestone ID
 * @param {string} adminId - The admin's user ID
 * @param {object} data - { resolution: "APPROVE_RELEASE" | "REJECT", adminComment }
 * @returns {object} Updated milestone
 */
const resolveDispute = async (milestoneId, adminId, data) => {
  const { resolution, adminComment } = data;

  const milestone = await prisma.escrowMilestone.findUnique({
    where: { id: milestoneId },
    include: {
      escrow: {
        include: { project: true },
      },
      collaborators: {
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
          },
        },
      },
    },
  });

  if (!milestone) {
    throw new Error("Milestone not found.");
  }

  if (milestone.status !== "DISPUTED") {
    throw new Error(`Only disputed milestones can be resolved. Current status: ${milestone.status}.`);
  }

  let result;

  if (resolution === "APPROVE_RELEASE") {
    // Release the payment to all collaborators
    result = await escrowReleaseService.releaseMilestonePayment(
      milestone,
      milestone.escrow.project.name,
      false
    );

    // Update dispute resolution
    await prisma.escrowMilestone.update({
      where: { id: milestoneId },
      data: {
        disputeResolution: `Admin approved release. ${adminComment}`,
      },
    });
  } else {
    // Reject — set milestone back to PENDING for re-submission
    result = await prisma.escrowMilestone.update({
      where: { id: milestoneId },
      data: {
        status: "PENDING",
        disputeResolution: `Admin rejected release. ${adminComment}`,
        submittedAt: null,
        reviewDeadline: null,
        evidence: {},
      },
    });
  }

  // Log activity
  await prisma.escrowActivity.create({
    data: {
      escrowId: milestone.escrowId,
      userId: adminId,
      action: `DISPUTE_RESOLVED_${resolution}`,
      details: `Admin resolved dispute on "${milestone.title}": ${resolution}. ${adminComment}`,
      metadata: { milestoneId, resolution, adminComment, adminId },
    },
  });

  // Project activity log
  await prisma.activityLog.create({
    data: {
      projectId: milestone.escrow.projectId,
      action: "DISPUTE_RESOLVED",
      details: `Dispute on "${milestone.title}" resolved by admin: ${resolution}.`,
    },
  });

  return result;
};

/**
 * Process auto-releases for milestones past their review deadline.
 * Called by the scheduled job. Finds all AWAITING_REVIEW milestones
 * with expired review deadlines and auto-approves them, releasing
 * payment to all linked collaborators.
 *
 * @returns {number} Number of milestones auto-released
 */
const processAutoReleases = async () => {
  const now = new Date();

  const expiredMilestones = await prisma.escrowMilestone.findMany({
    where: {
      status: "AWAITING_REVIEW",
      reviewDeadline: { lt: now },
    },
    include: {
      escrow: {
        include: { project: true },
      },
      collaborators: {
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
          },
        },
      },
    },
  });

  let autoReleasedCount = 0;

  for (const milestone of expiredMilestones) {
    try {
      const result = await escrowReleaseService.releaseMilestonePayment(
        milestone,
        milestone.escrow.project.name,
        true // auto-released
      );

      const collabNames = milestone.collaborators
        .map((mc) => mc.user.displayName || mc.user.email)
        .join(", ");

      // Log activity
      await prisma.escrowActivity.create({
        data: {
          escrowId: milestone.escrowId,
          userId: null,
          action: "MILESTONE_AUTO_RELEASED",
          details: `Milestone "${milestone.title}" auto-released after review deadline expired. ₦${Number(milestone.amount).toLocaleString()} credited to each of ${milestone.collaborators.length} collaborator(s): ${collabNames}. Total: ₦${result.totalReleased.toLocaleString()}.`,
          metadata: {
            milestoneId: milestone.id,
            amountPerCollaborator: Number(milestone.amount),
            totalReleased: result.totalReleased,
            collaboratorCount: milestone.collaborators.length,
            reviewDeadline: milestone.reviewDeadline,
          },
        },
      });

      // Project activity log
      await prisma.activityLog.create({
        data: {
          projectId: milestone.escrow.projectId,
          action: "MILESTONE_AUTO_RELEASED",
          details: `Milestone "${milestone.title}" auto-released. ₦${result.totalReleased.toLocaleString()} credited to ${milestone.collaborators.length} collaborator(s).`,
        },
      });

      autoReleasedCount++;
      console.log(`[Auto-Release] Released milestone "${milestone.title}" (${milestone.id}) to ${milestone.collaborators.length} collaborator(s)`);
    } catch (error) {
      console.error(`[Auto-Release Error] Failed to release milestone ${milestone.id}:`, error.message);
    }
  }

  return autoReleasedCount;
};

/**
 * Get detailed milestone information including evidence, collaborators, and history.
 *
 * @param {string} projectId - The project ID
 * @param {string} milestoneId - The milestone ID
 * @param {string} userId - The requesting user's ID
 * @returns {object} Milestone with full details
 */
const getMilestoneDetails = async (projectId, milestoneId, userId) => {
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

  const milestone = await prisma.escrowMilestone.findUnique({
    where: { id: milestoneId },
    include: {
      escrow: {
        select: { id: true, projectId: true, status: true, reviewPeriodDays: true },
      },
      collaborators: {
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, displayName: true },
          },
        },
      },
    },
  });

  if (!milestone) {
    throw new Error("Milestone not found.");
  }

  if (milestone.escrow.projectId !== projectId) {
    throw new Error("Milestone does not belong to this project.");
  }

  return milestone;
};

module.exports = {
  submitMilestone,
  approveMilestone,
  disputeMilestone,
  resolveDispute,
  processAutoReleases,
  getMilestoneDetails,
};
