const prisma = require("../../../config/prismaClient");

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
          role: "OWNER",
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

  return project;
};

const getProjectListService = async (userId) => {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          collaborators: {
            some: { userId: userId },
          },
        },
      ],
      status: "ACTIVE",
    },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
        },
      },
      collaborators: {
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
  });

  return projects;
};

const getProjectDetailsService = async (projectId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      collaborators: {
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

  return project;
};

const inviteCollaboratorService = async (projectId, collaboratorId) => {
  // Check if collaborator exists
  const user = await prisma.userProfile.findUnique({
    where: { id: collaboratorId },
  });

  if (!user) {
    throw new Error("User to invite not found");
  }

  // Add collaborator
  const collaborator = await prisma.projectCollaborator.create({
    data: {
      projectId,
      userId: collaboratorId,
      role: "COLLABORATOR",
    },
  });

  // Create notification for the user
  await prisma.notification.create({
    data: {
      userId: collaboratorId,
      title: "New Project Invitation",
      message: `You have been invited to collaborate on project.`,
      type: "INVITE",
      link: `/projects/${projectId}`,
    },
  });

  return collaborator;
};

module.exports = {
  createProjectService,
  getProjectListService,
  getProjectDetailsService,
  inviteCollaboratorService,
};
