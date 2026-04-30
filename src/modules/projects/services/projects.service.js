const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");
const {
  PROJECT_VISIBILITY,
  PROJECT_STATUS,
  COLLABORATOR_ROLE,
} = require("../../../utils/constants");

const createProjectService = async ({
  userId,
  name,
  description,
  genre,
  startDate,
  visibility,
}) => {
  const project = await prisma.project.create({
    data: {
      name,
      description,
      genre,
      startDate: new Date(startDate),
      visibility,
      ownerId: userId,
      // Create initial owner as collaborator
      collaborators: {
        create: {
          userId: userId,
          role: COLLABORATOR_ROLE.OWNER,
        },
      },
      // Automatically generate initial activity
      activities: {
        create: {
          action: "PROJECT_CREATED",
          details: `Project "${name}" was created.`,
        },
      },
    },
    include: {
      collaborators: true,
      activities: true,
    },
  });

  // Publish event — notification creation is handled by the listener
  await publishEvent(EVENT_TYPES.PROJECT_CREATED, { project, userId });

  return project;
};

const getProjectListService = async (userId, filters = {}) => {
  const {
    visibility = PROJECT_VISIBILITY.PUBLIC,
    page = 1,
    limit = 10,
  } = filters;
  const skip = (page - 1) * limit;
  const take = parseInt(limit);

  const where = {
    status: "ACTIVE",
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
    orderBy: { createdAt: "desc" },
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

  if (!project) {
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

const inviteCollaboratorService = async (
  projectId,
  collaboratorId,
  inviterId
) => {
  // 1. Basic check: Can't invite yourself
  if (collaboratorId === inviterId) {
    throw new Error("You cannot invite yourself to your own project.");
  }

  // 2. Fetch project, invited user, and check inviter permissions in parallel
  const [project, user, existingCollaborator] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        collaborators: {
          where: { userId: inviterId },
        },
      },
    }),
    prisma.userProfile.findUnique({
      where: { id: collaboratorId },
      select: { id: true },
    }),
    prisma.projectCollaborator.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: collaboratorId,
        },
      },
    }),
  ]);

  // 3. Existence Validations
  if (!project) {
    throw new Error("Project not found.");
  }

  if (!user) {
    throw new Error("The user you are trying to invite does not exist.");
  }

  // 4. Permission Validation: Is the inviter the owner or a collaborator?
  const isOwner = project.ownerId === inviterId;
  const isExistingCollaborator = project.collaborators.length > 0;

  if (!isOwner && !isExistingCollaborator) {
    throw new Error(
      "You do not have permission to invite collaborators to this project."
    );
  }

  // 5. Redundancy Validations
  if (project.ownerId === collaboratorId) {
    throw new Error("This user is already the owner of the project.");
  }

  if (existingCollaborator) {
    if (existingCollaborator.isActive) {
      throw new Error(
        "This user is already an active collaborator on this project."
      );
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

  // 6. Add new collaborator
  const collaborator = await prisma.projectCollaborator.create({
    data: {
      projectId,
      userId: collaboratorId,
      role: COLLABORATOR_ROLE.COLLABORATOR,
    },
  });

  // 7. Publish event — notification creation is handled by the listener
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
    select: { ownerId: true },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  if (project.ownerId !== userId) {
    throw new Error("Only the project owner can update project settings.");
  }

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...updateData,
      startDate: updateData.startDate
        ? new Date(updateData.startDate)
        : undefined,
    },
  });

  return updatedProject;
};

const deleteProjectService = async (projectId, userId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true, name: true },
  });

  if (!project) {
    throw new Error("Project not found.");
  }

  if (project.ownerId !== userId) {
    throw new Error("Only the project owner can delete this project.");
  }

  await prisma.project.delete({
    where: { id: projectId },
  });

  return { message: `Project "${project.name}" has been deleted.` };
};

const removeCollaboratorService = async (
  projectId,
  targetUserId,
  requesterId
) => {
  // 1. Fetch project to check ownership
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });

  if (!project) {
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

  // 5. Soft delete: Update isActive to false
  await prisma.projectCollaborator.update({
    where: { id: collaboratorRecord.id },
    data: { isActive: false },
  });

  return { message: "Collaborator removed successfully (soft delete)." };
};

module.exports = {
  createProjectService,
  getProjectListService,
  getProjectDetailsService,
  inviteCollaboratorService,
  updateProjectService,
  deleteProjectService,
  removeCollaboratorService,
};

