const prisma = require("../../../config/prismaClient");
const { publisherClient } = require("../../../config/redis");
const EVENT_TYPES = require("../../../events/eventTypes");

/**
 * Submit an application to a project
 */
const applyToProjectService = async (projectId, applicantId, message) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project || project.isDeleted) {
    throw new Error("Project not found.");
  }

  if (!project.openToCollaborators) {
    throw new Error("This project is not currently accepting applications.");
  }

  if (project.ownerId === applicantId) {
    throw new Error("You cannot apply to your own project.");
  }

  // Check if already a collaborator
  const collaborator = await prisma.projectCollaborator.findFirst({
    where: { projectId, userId: applicantId, isActive: true },
  });
  if (collaborator) {
    throw new Error("You are already a collaborator on this project.");
  }

  // Check if application already exists
  const existingApp = await prisma.projectApplication.findUnique({
    where: {
      projectId_applicantId: { projectId, applicantId },
    },
  });
  if (existingApp) {
    throw new Error("You have already applied to this project.");
  }

  const application = await prisma.projectApplication.create({
    data: {
      projectId,
      applicantId,
      message,
      status: "APPLIED",
    },
  });

  // Get applicant name for notification
  const applicant = await prisma.userProfile.findUnique({
    where: { id: applicantId },
    select: { displayName: true, firstName: true, lastName: true },
  });
  const applicantName = applicant
    ? (applicant.displayName || `${applicant.firstName} ${applicant.lastName}`)
    : "A collaborator";

  // Publish event for notifications
  await publisherClient.publish(
    EVENT_TYPES.PROJECT_APPLICATION_SUBMITTED,
    JSON.stringify({
      applicationId: application.id,
      projectId,
      projectName: project.name,
      ownerId: project.ownerId,
      applicantName,
    })
  );

  return application;
};

/**
 * List all applications for a specific project (Project Owner only)
 */
const getProjectApplicationsService = async (projectId, ownerId) => {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId, isDeleted: false },
  });

  if (!project) {
    throw new Error("Project not found or you are not the owner.");
  }

  const applications = await prisma.projectApplication.findMany({
    where: { projectId },
    include: {
      applicant: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          skills: true,
          genres: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return applications;
};

/**
 * List all applications submitted by the current user
 */
const getMyApplicationsService = async (applicantId) => {
  const applications = await prisma.projectApplication.findMany({
    where: { applicantId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          genre: true,
          startDate: true,
          endDate: true,
          owner: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return applications;
};

/**
 * Retrieve details for a single application (Applicant or Owner only)
 */
const getApplicationDetailsService = async (applicationId, userId) => {
  const application = await prisma.projectApplication.findUnique({
    where: { id: applicationId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          ownerId: true,
        },
      },
      applicant: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!application) {
    throw new Error("Application not found.");
  }

  if (application.applicantId !== userId && application.project.ownerId !== userId) {
    throw new Error("Access denied. You must be the applicant or project owner.");
  }

  return application;
};

/**
 * Send a message on a project application
 */
const sendApplicationMessageService = async (applicationId, senderId, messageContent) => {
  const application = await getApplicationDetailsService(applicationId, senderId);

  const message = await prisma.applicationMessage.create({
    data: {
      applicationId,
      senderId,
      message: messageContent,
    },
    include: {
      sender: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return message;
};

/**
 * List negotiation messages on an application
 */
const getApplicationMessagesService = async (applicationId, userId) => {
  await getApplicationDetailsService(applicationId, userId);

  const messages = await prisma.applicationMessage.findMany({
    where: { applicationId },
    include: {
      sender: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return messages;
};

/**
 * Review/Update project application status (Accept / Reject)
 */
const reviewApplicationService = async (applicationId, ownerId, status) => {
  const application = await prisma.projectApplication.findUnique({
    where: { id: applicationId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          ownerId: true,
        },
      },
    },
  });

  if (!application) {
    throw new Error("Application not found.");
  }

  if (application.project.ownerId !== ownerId) {
    throw new Error("Access denied. Only the project owner can review applications.");
  }

  if (application.status !== "APPLIED") {
    throw new Error(`Application has already been ${application.status.toLowerCase()}.`);
  }

  if (!["ACCEPTED", "REJECTED"].includes(status)) {
    throw new Error("Invalid status. Must be ACCEPTED or REJECTED.");
  }

  const updatedApplication = await prisma.projectApplication.update({
    where: { id: applicationId },
    data: { status },
  });

  // If accepted, add applicant to project collaborators
  if (status === "ACCEPTED") {
    const existingCollaborator = await prisma.projectCollaborator.findFirst({
      where: { projectId: application.projectId, userId: application.applicantId },
    });

    if (existingCollaborator) {
      await prisma.projectCollaborator.update({
        where: { id: existingCollaborator.id },
        data: { isActive: true },
      });
    } else {
      await prisma.projectCollaborator.create({
        data: {
          projectId: application.projectId,
          userId: application.applicantId,
          role: "COLLABORATOR",
          isActive: true,
        },
      });
    }
  }

  // Publish event for status change notification
  await publisherClient.publish(
    EVENT_TYPES.PROJECT_APPLICATION_STATUS_CHANGED,
    JSON.stringify({
      applicationId,
      projectId: application.projectId,
      projectName: application.project.name,
      applicantId: application.applicantId,
      status,
    })
  );

  return updatedApplication;
};

module.exports = {
  applyToProjectService,
  getProjectApplicationsService,
  getMyApplicationsService,
  getApplicationDetailsService,
  sendApplicationMessageService,
  getApplicationMessagesService,
  reviewApplicationService,
};
