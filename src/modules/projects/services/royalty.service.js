const prisma = require("../../../config/prismaClient");

/**
 * Get royalty splits for a project.
 * Accessible to project owners and active collaborators.
 */
const getProjectRoyaltySplits = async (projectId, userId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      collaborators: { where: { isActive: true } },
    },
  });

  if (!project || project.isDeleted) {
    const error = new Error("Project not found.");
    error.status = 404;
    throw error;
  }

  const isOwner = project.ownerId === userId;
  const isCollaborator = project.collaborators.some((c) => c.userId === userId);

  if (!isOwner && !isCollaborator) {
    const error = new Error("Access denied.");
    error.status = 403;
    throw error;
  }

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

  return {
    projectId,
    totalShare,
    remainingShare: Math.max(0, 100 - totalShare),
    splits,
  };
};

/**
 * Configure / update royalty splits for a project.
 * Only the project owner can update royalty splits.
 * Validates that total shares do not exceed 100%.
 */
const updateProjectRoyaltySplits = async (projectId, ownerId, splitsData) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, name: true, isDeleted: true },
  });

  if (!project || project.isDeleted) {
    const error = new Error("Project not found.");
    error.status = 404;
    throw error;
  }

  if (project.ownerId !== ownerId) {
    const error = new Error("Only the project owner can update royalty splits.");
    error.status = 403;
    throw error;
  }

  if (!Array.isArray(splitsData)) {
    const error = new Error("Splits must be an array of collaborator royalty allocations.");
    error.status = 400;
    throw error;
  }

  const totalShare = splitsData.reduce((sum, s) => sum + Number(s.royaltyShare || 0), 0);
  if (totalShare > 100) {
    const error = new Error(`Total royalty split percentage cannot exceed 100%. Current sum: ${totalShare}%.`);
    error.status = 400;
    throw error;
  }

  // Update in a transaction
  await prisma.$transaction(async (tx) => {
    for (const split of splitsData) {
      const { userId, royaltyShare, role } = split;
      if (!userId || royaltyShare === undefined) continue;

      await tx.projectRoyaltySplit.upsert({
        where: {
          projectId_userId: { projectId, userId },
        },
        create: {
          projectId,
          userId,
          royaltyShare: Number(royaltyShare),
          role: role || null,
        },
        update: {
          royaltyShare: Number(royaltyShare),
          role: role || null,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        projectId,
        action: "ROYALTY_SPLITS_UPDATED",
        details: `Royalty splits updated for ${splitsData.length} collaborator(s). Total configured: ${totalShare}%.`,
      },
    });
  });

  return await getProjectRoyaltySplits(projectId, ownerId);
};

module.exports = {
  getProjectRoyaltySplits,
  updateProjectRoyaltySplits,
};
