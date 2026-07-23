const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const {
  PROJECT_VISIBILITY,
  PROJECT_STATUS,
  COLLABORATOR_ROLE,
} = require("../../../utils/constants");
const { TIER_LIMITS } = require("../../../config/constants");

const checkConnection = async (userId, targetId) => {
  const connection = await prisma.userConnection.findFirst({
    where: {
      OR: [
        { senderId: userId, receiverId: targetId, status: "ACCEPTED" },
        { senderId: targetId, receiverId: userId, status: "ACCEPTED" },
      ],
    },
  });
  return !!connection;
};

const createProjectService = async ({
  userId,
  name,
  description,
  genre,
  startDate,
  visibility,
  collaboratorIds = [],
  openToCollaborators = false,
  requiredRoles = [],
  requiredSkills = [],
}) => {
  // Fetch user profile for tier check
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    include: {
      ownedProjects: {
        where: { status: "ACTIVE", isDeleted: false },
      },
    },
  });

  if (!user) throw new Error("User not found");

  if (!user.identityVerified || !user.legalName) {
    throw new Error("You must complete your identity verification (via government ID/NIN) and set your legal name before creating a project.");
  }

  const limits = TIER_LIMITS[user.tier];



  // Check collaborator invitations
  if (collaboratorIds.length > 0) {
    // 1. Check collaborator limit
    if (collaboratorIds.length > limits.MAX_COLLABORATORS) {
      throw new Error(`Collaborator limit reached for ${user.tier} tier. Max ${limits.MAX_COLLABORATORS} collaborators allowed.`);
    }

    // 2. Check connections
    // 2. Check connections and verification
    for (const collaboratorId of collaboratorIds) {
      const isConnected = await checkConnection(userId, collaboratorId);
      if (!isConnected) {
        throw new Error(`You can only invite collaborators you are connected with. Please send a connection request to user ${collaboratorId} first.`);
      }

      const colProfile = await prisma.userProfile.findUnique({
        where: { id: collaboratorId },
      });

      if (!colProfile || !colProfile.identityVerified || !colProfile.legalName) {
        throw new Error(`Collaborator ${collaboratorId} must complete their identity verification (via government ID/NIN) and set their legal name before they can collaborate on projects.`);
      }
    }
  }

  const projectData = {
    name,
    description,
    genre,
    startDate: new Date(startDate),
    visibility,
    ownerId: userId,
    openToCollaborators,
    requiredRoles,
    requiredSkills,
    collaborators: {
      create: [
        {
          userId: userId,
          role: COLLABORATOR_ROLE.OWNER,
        },
        ...collaboratorIds.map((id) => ({
          userId: id,
          role: COLLABORATOR_ROLE.COLLABORATOR,
        })),
      ],
    },
    activities: {
      create: {
        action: "PROJECT_CREATED",
        details: `Project "${name}" was created with ${collaboratorIds.length} initial collaborators.`,
      },
    },
    metadata: {
      creatorId: userId,
      initialCollaboratorCount: collaboratorIds.length,
      creationPlatform: "web-dashboard",
    },
  };

  const project = await prisma.project.create({
    data: projectData,
    include: {
      collaborators: true,
      activities: true,
    },
  });

  // Publish event
  await publishEvent(EVENT_TYPES.PROJECT_CREATED, { project, userId });

  return project;
};

const getProjectListService = async (userId, filters = {}) => {
  const {
    visibility,
    page = 1,
    limit = 10,
    status,
    search,
    genre,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;
  const skip = (Math.max(1, parseInt(page) || 1) - 1) * Math.min(100, Math.max(1, parseInt(limit) || 10));
  const take = Math.min(100, Math.max(1, parseInt(limit) || 10));

  const where = {
    isDeleted: false,
    AND: [],
  };

  if (visibility) {
    where.visibility = visibility;

    // If filtering for PRIVATE, must be owner or collaborator
    if (visibility === PROJECT_VISIBILITY.PRIVATE) {
      where.AND.push({
        OR: [
          { ownerId: userId },
          {
            collaborators: {
              some: {
                userId: userId,
                isActive: true,
              },
            },
          },
        ],
      });
    }
  } else {
    // Default: Show my projects (owner/collaborator) OR public projects
    where.AND.push({
      OR: [
        { ownerId: userId },
        {
          collaborators: {
            some: {
              userId: userId,
              isActive: true,
            },
          },
        },
        { visibility: PROJECT_VISIBILITY.PUBLIC },
      ],
    });
  }

  if (status) {
    where.status = status;
  }

  if (genre) {
    where.genre = genre;
  }

  if (search) {
    where.AND.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  // Define allowed sorting fields to prevent injection or invalid fields
  const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'startDate'];
  const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const validSortOrder = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

  // Fetch total count for pagination metadata
  const total = await prisma.project.count({ where });

  const projects = await prisma.project.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          email: true,
        },
      },
      collaborators: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: { [validSortBy]: validSortOrder },
    skip,
    take,
  });

  return {
    projects,
    meta: {
      total,
      page: parseInt(page),
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
};

const getProjectDetailsService = async (projectId, userId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      collaborators: {
        where: { isActive: true },
        include: {
          user: true,
        },
      },
      tasks: true,
      files: true,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      agreements: true,
      activities: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found");
  }

  // Visibility Check
  if (project.visibility === PROJECT_VISIBILITY.PRIVATE) {
    const isOwner = project.ownerId === userId;
    const isCollaborator = project.collaborators.some(
      (c) => c.userId === userId && c.isActive
    );

    if (!isOwner && !isCollaborator) {
      throw new Error("Project not found");
    }
  }

  return project;
};

const inviteCollaboratorService = async (projectId, collaboratorId, inviterId) => {
  // 1. Fetch project to check permissions and limits
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      collaborators: true,
    },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  // 2. Permission Validation: Only owner can invite for now (as per requirements)
  if (project.ownerId !== inviterId) {
    throw new Error("Only the project owner can invite collaborators.");
  }

  // 3. User Validation
  if (project.ownerId === collaboratorId) {
    throw new Error("This user is already the owner of the project.");
  }

  const userToInvite = await prisma.userProfile.findUnique({
    where: { id: collaboratorId },
  });

  if (!userToInvite) {
    throw new Error("The user you are trying to invite does not exist.");
  }

  if (!userToInvite.identityVerified || !userToInvite.legalName) {
    throw new Error("Collaborators must complete their identity verification (via government ID/NIN) and set their legal name before being added to a project.");
  }

  // 4. Connection Check
  const isConnected = await checkConnection(inviterId, collaboratorId);
  if (!isConnected) {
    throw new Error("You can only invite collaborators you are connected with.");
  }

  // 5. Tier/Limit Check
  const limits = TIER_LIMITS[project.owner.tier];
  const activeCollaborators = project.collaborators.filter(c => c.isActive && c.role !== COLLABORATOR_ROLE.OWNER);

  if (limits.MAX_COLLABORATORS !== -1 && activeCollaborators.length >= limits.MAX_COLLABORATORS) {
    throw new Error(`Collaborator limit reached for ${project.owner.tier} tier. Max ${limits.MAX_COLLABORATORS} collaborators allowed.`);
  }

  // 6. Check if already a collaborator (including inactive ones)
  const existingCollaborator = await prisma.projectCollaborator.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: collaboratorId,
      },
    },
  });

  if (existingCollaborator) {
    if (existingCollaborator.isActive) {
      throw new Error("This user is already an active collaborator on this project.");
    } else {
      // Reactivate soft-deleted collaborator
      const collaborator = await prisma.projectCollaborator.update({
        where: { id: existingCollaborator.id },
        data: { isActive: true, role: COLLABORATOR_ROLE.COLLABORATOR },
      });

      await publishEvent(EVENT_TYPES.COLLABORATOR_INVITED, {
        projectId,
        projectName: project.name,
        collaboratorId,
      });

      return collaborator;
    }
  }

  // 7. Add new collaborator
  const collaborator = await prisma.projectCollaborator.create({
    data: {
      projectId,
      userId: collaboratorId,
      role: COLLABORATOR_ROLE.COLLABORATOR,
    },
  });

  // 8. Publish event
  await publishEvent(EVENT_TYPES.COLLABORATOR_INVITED, {
    projectId,
    projectName: project.name,
    collaboratorId,
  });

  return collaborator;
};

const updateProjectService = async (projectId, userId, updateData) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, isDeleted: true },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  if (project.ownerId !== userId) {
    throw new Error("Only the project owner can update project settings.");
  }

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...updateData,
      startDate: updateData.startDate ? new Date(updateData.startDate) : undefined,
    },
  });

  await publishEvent(EVENT_TYPES.PROJECT_UPDATED, {
    projectId,
    userId,
    updateData,
  });

  return updatedProject;
};

const deleteProjectService = async (projectId, userId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, name: true, isDeleted: true },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  if (project.ownerId !== userId) {
    throw new Error("Only the project owner can delete this project.");
  }

  // Soft delete
  await prisma.project.update({
    where: { id: projectId },
    data: { isDeleted: true },
  });

  await publishEvent(EVENT_TYPES.PROJECT_DELETED, {
    projectId,
    projectName: project.name,
    userId,
  });

  return { message: `Project "${project.name}" has been deleted.` };
};

const removeCollaboratorService = async (projectId, targetUserId, requesterId) => {
  // 1. Fetch project to check ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, isDeleted: true },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  // 2. Find the active collaborator record
  const collaboratorRecord = await prisma.projectCollaborator.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: targetUserId,
      },
    },
  });

  if (!collaboratorRecord || !collaboratorRecord.isActive) {
    throw new Error("User is not an active collaborator in this project.");
  }

  // 3. Permission Check: Only owner can remove others, or a collaborator can remove themselves
  if (project.ownerId !== requesterId && targetUserId !== requesterId) {
    throw new Error("You do not have permission to remove this collaborator.");
  }

  // 4. Safety Check: Cannot remove the owner
  if (project.ownerId === targetUserId) {
    throw new Error("The project owner cannot be removed from the project.");
  }

  // 5. Remove the collaborator (soft delete)
  await prisma.projectCollaborator.update({
    where: { id: collaboratorRecord.id },
    data: { isActive: false },
  });

  // 6. Publish event
  await publishEvent(EVENT_TYPES.COLLABORATOR_REMOVED, {
    projectId,
    projectName: project.name,
    removedUserId: targetUserId,
  });

  return { message: "Collaborator removed successfully." };
};

const getProjectMetadataService = async (projectId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      _count: {
        select: {
          tasks: true,
          files: true,
          messages: true,
          agreements: true,
        },
      },
      collaborators: {
        where: { isActive: true },
      },
    },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found");
  }

  return {
    projectId: project.id,
    name: project.name,
    ownerId: project.ownerId,
    status: project.status,
    visibility: project.visibility,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    creationMetadata: project.metadata,
    currentStats: {
      ...project._count,
      collaborators: project.collaborators.length,
    },
  };
};

const getMarketplaceProjectsService = async (userId, filters = {}) => {
  const {
    page = 1,
    limit = 10,
    genre,
    role,
    requirements,
    search,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;

  const skip = (Math.max(1, parseInt(page) || 1) - 1) * Math.min(100, Math.max(1, parseInt(limit) || 10));
  const take = Math.min(100, Math.max(1, parseInt(limit) || 10));

  const where = {
    isDeleted: false,
    visibility: "PUBLIC",
    openToCollaborators: true,
    AND: [],
  };

  if (genre) {
    where.genre = { contains: genre, mode: 'insensitive' };
  }

  if (role) {
    where.requiredRoles = { has: role };
  }

  if (requirements) {
    where.requiredSkills = { has: requirements };
  }

  if (search) {
    where.AND.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  if (startDate) {
    where.startDate = { gte: new Date(startDate) };
  }

  if (endDate) {
    where.endDate = { lte: new Date(endDate) };
  }

  const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'startDate'];
  const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const validSortOrder = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

  const total = await prisma.project.count({ where });

  const projects = await prisma.project.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          tier: true,
        },
      },
      _count: {
        select: {
          collaborators: true,
          applications: true,
        },
      },
    },
    orderBy: { [validSortBy]: validSortOrder },
    skip,
    take,
  });

  return {
    projects,
    meta: {
      total,
      page: parseInt(page),
      limit: take,
      totalPages: Math.ceil(total / take),
    },
  };
};

const getMarketplaceProjectSummaryService = async (projectId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          tier: true,
        },
      },
      _count: {
        select: {
          collaborators: true,
        },
      },
    },
  });

  if (!project || project.isDeleted || project.visibility !== "PUBLIC" || !project.openToCollaborators) {
    throw new Error("Project summary not found, is private, or not open to collaborators.");
  }

  return project;
};

module.exports = {
  createProjectService,
  getProjectListService,
  getProjectDetailsService,
  inviteCollaboratorService,
  updateProjectService,
  deleteProjectService,
  removeCollaboratorService,
  getProjectMetadataService,
  getMarketplaceProjectsService,
  getMarketplaceProjectSummaryService,
};
