const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const {
  LIVE_AGREEMENT_STATUSES,
  projectHasRoyalties,
  getPendingRoyaltyAcceptanceIds,
  normalizeRoyaltySplits,
  hasSplitTermsChanged,
  getRoyaltyEditBlocker,
} = require("../../../helpers/royaltyTerms");

const httpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const loadProject = async (projectId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      isDeleted: true,
      collaborators: {
        where: { isActive: true },
        select: { userId: true, inviteStatus: true },
      },
    },
  });

  if (!project || project.isDeleted) throw httpError("Project not found.", 404);
  return project;
};

// Owner plus accepted, active collaborators — the same set required to sign agreements.
const getSignerIds = (project) => [
  ...new Set([
    project.ownerId,
    ...project.collaborators.filter((c) => c.inviteStatus === "ACCEPTED").map((c) => c.userId),
  ]),
];

/**
 * Get royalty splits for a project.
 * Accessible to project owners and active collaborators.
 */
const getProjectRoyaltySplits = async (projectId, userId) => {
  const project = await loadProject(projectId);

  const isOwner = project.ownerId === userId;
  const isCollaborator = project.collaborators.some((c) => c.userId === userId);

  if (!isOwner && !isCollaborator) throw httpError("Access denied.", 403);

  const splits = await prisma.projectRoyaltySplit.findMany({
    where: { projectId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          legalName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const totalShare = splits.reduce((sum, s) => sum + Number(s.royaltyShare), 0);
  const pendingAcceptanceFrom = getPendingRoyaltyAcceptanceIds(splits, getSignerIds(project), project.ownerId);

  return {
    projectId,
    totalShare,
    remainingShare: Math.max(0, 100 - totalShare),
    hasRoyalties: projectHasRoyalties(splits),
    allAccepted: pendingAcceptanceFrom.length === 0,
    pendingAcceptanceFrom,
    splits,
  };
};

/**
 * Configure / update royalty splits for a project.
 * Only the project owner can update royalty splits.
 * Any split whose share or role changes goes back to PENDING and must be re-accepted.
 */
const updateProjectRoyaltySplits = async (projectId, ownerId, splitsData) => {
  const project = await loadProject(projectId);

  if (project.ownerId !== ownerId) {
    throw httpError("Only the project owner can update royalty splits.", 403);
  }

  const eligibleUserIds = [project.ownerId, ...project.collaborators.map((c) => c.userId)];
  const splits = normalizeRoyaltySplits(splitsData, eligibleUserIds);

  const agreements = await prisma.legalAgreement.findMany({
    where: { projectId },
    select: { status: true, signatures: { select: { id: true } } },
  });
  const editBlocker = getRoyaltyEditBlocker(agreements);
  if (editBlocker) throw httpError(editBlocker, 409);

  const existing = await prisma.projectRoyaltySplit.findMany({ where: { projectId } });
  const existingByUser = new Map(existing.map((s) => [s.userId, s]));
  const changed = splits.filter((s) => hasSplitTermsChanged(existingByUser.get(s.userId), s));
  const totalShare = splits.reduce((sum, s) => sum + s.royaltyShare, 0);

  await prisma.$transaction(async (tx) => {
    for (const split of changed) {
      const isOwnerSplit = split.userId === project.ownerId;
      const approval = {
        approvalStatus: isOwnerSplit ? "ACCEPTED" : "PENDING",
        approvalComment: null,
        respondedAt: isOwnerSplit ? new Date() : null,
      };

      await tx.projectRoyaltySplit.upsert({
        where: { projectId_userId: { projectId, userId: split.userId } },
        create: { projectId, ...split, ...approval },
        update: { royaltyShare: split.royaltyShare, role: split.role, ...approval },
      });
    }

    await tx.activityLog.create({
      data: {
        projectId,
        action: "ROYALTY_SPLITS_UPDATED",
        details: `Royalty splits updated for ${splits.length} collaborator(s). Total configured: ${totalShare}%.`,
      },
    });
  });

  const recipientIds = changed.map((s) => s.userId).filter((id) => id !== project.ownerId);
  if (recipientIds.length > 0) {
    await publishEvent(EVENT_TYPES.ROYALTY_TERMS_UPDATED, {
      projectId,
      projectName: project.name,
      recipientIds,
    });
  }

  return await getProjectRoyaltySplits(projectId, ownerId);
};

/**
 * A collaborator accepts or rejects their own royalty split.
 * Accepting is required before they can sign any agreement on the project.
 */
const respondToRoyaltySplit = async (projectId, userId, decision, comment) => {
  if (!["ACCEPT", "REJECT"].includes(decision)) {
    throw httpError("Decision must be either ACCEPT or REJECT.", 400);
  }

  const project = await loadProject(projectId);

  if (project.ownerId === userId) {
    throw httpError("The project owner sets the royalty terms and does not need to respond.", 400);
  }

  const split = await prisma.projectRoyaltySplit.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!split) throw httpError("No royalty share has been assigned to you on this project.", 404);

  const signedLiveAgreement = await prisma.agreementSignature.findFirst({
    where: {
      userId,
      agreement: { projectId, status: { in: LIVE_AGREEMENT_STATUSES } },
    },
    select: { id: true },
  });
  if (signedLiveAgreement) {
    throw httpError("You have already signed an agreement based on these royalty terms and can no longer change your response.", 409);
  }

  const approvalStatus = decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";

  const updated = await prisma.projectRoyaltySplit.update({
    where: { id: split.id },
    data: {
      approvalStatus,
      approvalComment: comment || null,
      respondedAt: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      projectId,
      action: `ROYALTY_TERMS_${approvalStatus}`,
      details: `A collaborator ${approvalStatus.toLowerCase()} their royalty share of ${Number(split.royaltyShare)}%.${comment ? ` Comment: ${comment}` : ""}`,
    },
  });

  await publishEvent(EVENT_TYPES.ROYALTY_TERMS_RESPONDED, {
    projectId,
    projectName: project.name,
    ownerId: project.ownerId,
    responderId: userId,
    decision: approvalStatus,
    royaltyShare: Number(split.royaltyShare),
    comment: comment || null,
  });

  return updated;
};

module.exports = {
  getProjectRoyaltySplits,
  updateProjectRoyaltySplits,
  respondToRoyaltySplit,
};
