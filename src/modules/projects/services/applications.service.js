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

  // Check if already an active collaborator
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

  let application;
  if (existingApp) {
    if (existingApp.status === "CANCELLED") {
      // Re-apply on previously cancelled application
      application = await prisma.projectApplication.update({
        where: { id: existingApp.id },
        data: {
          message,
          status: "APPLIED",
        },
      });
    } else {
      throw new Error("You have already applied to this project.");
    }
  } else {
    application = await prisma.projectApplication.create({
      data: {
        projectId,
        applicantId,
        message,
        status: "APPLIED",
      },
    });
  }

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
          bio: true,
          location: true,
          yearsOfExperience: true,
          role: true,
          skills: true,
          genres: true,
          portfolioLinks: true,
          socialLinks: true,
          creativePhilosophy: true,
          experience: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return applications.map((app) => ({
    ...app,
    pitch: app.message,
    portfolioLink: app.applicant?.portfolioLinks?.[0] || null,
  }));
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
          bio: true,
          location: true,
          yearsOfExperience: true,
          role: true,
          skills: true,
          genres: true,
          portfolioLinks: true,
          socialLinks: true,
          creativePhilosophy: true,
          experience: true,
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

  return {
    ...application,
    pitch: application.message,
    portfolioLink: application.applicant?.portfolioLinks?.[0] || null,
  };
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
 * Review/Update project application status (Accept / Reject / Decline / Cancel)
 */
const reviewApplicationService = async (applicationId, ownerId, status, targetProjectId = null) => {
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

  if (targetProjectId && application.projectId !== targetProjectId) {
    throw new Error("Application does not belong to this project.");
  }

  let normalizedStatus = status ? String(status).toUpperCase() : "";
  if (normalizedStatus === "ACCEPT") normalizedStatus = "ACCEPTED";
  if (normalizedStatus === "DECLINE" || normalizedStatus === "DECLINED" || normalizedStatus === "REJECT") normalizedStatus = "REJECTED";
  if (normalizedStatus === "CANCEL" || normalizedStatus === "CANCELED") normalizedStatus = "CANCELLED";

  if (!["ACCEPTED", "REJECTED", "CANCELLED"].includes(normalizedStatus)) {
    throw new Error("Invalid status. Must be ACCEPTED, REJECTED, or CANCELLED.");
  }

  if (normalizedStatus === "CANCELLED") {
    return cancelApplicationService(applicationId, ownerId, targetProjectId);
  }

  if (application.project.ownerId !== ownerId) {
    throw new Error("Access denied. Only the project owner can review applications.");
  }

  if (application.status !== "APPLIED") {
    throw new Error(`Application has already been ${application.status.toLowerCase()}.`);
  }

  const updatedApplication = await prisma.projectApplication.update({
    where: { id: applicationId },
    data: { status: normalizedStatus },
    include: {
      applicant: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          bio: true,
          location: true,
          skills: true,
          genres: true,
          portfolioLinks: true,
        },
      },
    },
  });

  // If accepted, add applicant to project collaborators
  if (normalizedStatus === "ACCEPTED") {
    const existingCollaborator = await prisma.projectCollaborator.findFirst({
      where: { projectId: application.projectId, userId: application.applicantId },
    });

    if (existingCollaborator) {
      await prisma.projectCollaborator.update({
        where: { id: existingCollaborator.id },
        data: { isActive: true, inviteStatus: "ACCEPTED" },
      });
    } else {
      await prisma.projectCollaborator.create({
        data: {
          projectId: application.projectId,
          userId: application.applicantId,
          role: "COLLABORATOR",
          isActive: true,
          inviteStatus: "ACCEPTED",
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
      status: normalizedStatus,
    })
  );

  return {
    ...updatedApplication,
    pitch: updatedApplication.message,
    portfolioLink: updatedApplication.applicant?.portfolioLinks?.[0] || null,
  };
};

/**
 * Cancel a project application (Applicant or Project Owner)
 */
const cancelApplicationService = async (applicationId, userId, targetProjectId = null) => {
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

  if (targetProjectId && application.projectId !== targetProjectId) {
    throw new Error("Application does not belong to this project.");
  }

  if (application.applicantId !== userId && application.project.ownerId !== userId) {
    throw new Error("Access denied. Only the applicant or project owner can cancel this application.");
  }

  if (application.status === "CANCELLED") {
    throw new Error("Application has already been cancelled.");
  }

  const updatedApplication = await prisma.projectApplication.update({
    where: { id: applicationId },
    data: { status: "CANCELLED" },
    include: {
      applicant: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          bio: true,
          location: true,
          skills: true,
          genres: true,
          portfolioLinks: true,
        },
      },
    },
  });

  // If application was previously accepted, deactivate collaborator
  if (application.status === "ACCEPTED") {
    const existingCollaborator = await prisma.projectCollaborator.findFirst({
      where: { projectId: application.projectId, userId: application.applicantId },
    });
    if (existingCollaborator) {
      await prisma.projectCollaborator.update({
        where: { id: existingCollaborator.id },
        data: { isActive: false, inviteStatus: "CANCELLED" },
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
      status: "CANCELLED",
    })
  );

  return {
    ...updatedApplication,
    pitch: updatedApplication.message,
    portfolioLink: updatedApplication.applicant?.portfolioLinks?.[0] || null,
  };
};

module.exports = {
  applyToProjectService,
  getProjectApplicationsService,
  getMyApplicationsService,
  getApplicationDetailsService,
  sendApplicationMessageService,
  getApplicationMessagesService,
  reviewApplicationService,
  cancelApplicationService,
};
