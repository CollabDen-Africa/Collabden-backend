const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");

/**
 * Retrieve collaborator profiles and project postings with summary counts, pagination, sorting, search, and filtering.
 * FR: FRA26, FRA27, FRA28 | NFR: NFRA18, NFRA19
 */
const getMarketplaceListings = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    type = "all", // "all", "profiles", "projects"
    search,
    profileStatus,
    openToCollaborate,
    projectStatus,
    reportStatus,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

  // Build Profile Query Conditions
  const profileWhere = {};
  if (search) {
    profileWhere.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }
  if (profileStatus && profileStatus !== "All") {
    profileWhere.accountStatus = profileStatus.toUpperCase();
  }
  if (openToCollaborate !== undefined && openToCollaborate !== "All") {
    profileWhere.openToCollaborate = openToCollaborate === "true" || openToCollaborate === true;
  }
  if (reportStatus && reportStatus !== "All") {
    if (reportStatus === "HAS_REPORTS") {
      profileWhere.reportsAgainst = { some: {} };
    } else if (reportStatus === "NO_REPORTS") {
      profileWhere.reportsAgainst = { none: {} };
    } else {
      profileWhere.reportsAgainst = { some: { status: reportStatus } };
    }
  }

  // Build Project Query Conditions
  const projectWhere = { visibility: "PUBLIC" };
  if (search) {
    projectWhere.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { owner: { displayName: { contains: search, mode: "insensitive" } } },
      { owner: { email: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (projectStatus && projectStatus !== "All") {
    const upperStatus = projectStatus.toUpperCase();
    if (upperStatus === "ARCHIVED" || upperStatus === "REMOVED") {
      projectWhere.isDeleted = true;
    } else {
      projectWhere.status = upperStatus;
      projectWhere.isDeleted = false;
    }
  } else {
    projectWhere.isDeleted = false;
  }
  if (reportStatus && reportStatus !== "All") {
    if (reportStatus === "HAS_REPORTS") {
      projectWhere.reports = { some: {} };
    } else if (reportStatus === "NO_REPORTS") {
      projectWhere.reports = { none: {} };
    } else {
      projectWhere.reports = { some: { status: reportStatus } };
    }
  }

  // Execute Parallel Queries
  const fetchProfiles = type === "all" || type === "profiles";
  const fetchProjects = type === "all" || type === "projects";

  const allowedUserSorts = ["createdAt", "displayName", "lastActiveAt"];
  const profileSortField = allowedUserSorts.includes(sortBy) ? sortBy : "createdAt";

  const allowedProjectSorts = ["createdAt", "name", "status"];
  const projectSortField = allowedProjectSorts.includes(sortBy) ? sortBy : "createdAt";

  const [
    totalProfilesCount,
    profilesList,
    totalProjectsCount,
    projectsList,
    statsTotalUsers,
    statsOpenToCollab,
    statsTotalProjects,
    statsPublicProjects,
    statsReportedProfiles,
    statsReportedProjects,
  ] = await Promise.all([
    fetchProfiles ? prisma.userProfile.count({ where: profileWhere }) : 0,
    fetchProfiles
      ? prisma.userProfile.findMany({
          where: profileWhere,
          skip,
          take: limitNum,
          orderBy: { [profileSortField]: direction },
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            bio: true,
            skills: true,
            genres: true,
            isVerified: true,
            identityVerified: true,
            openToCollaborate: true,
            accountStatus: true,
            tier: true,
            createdAt: true,
            lastActiveAt: true,
            _count: {
              select: {
                collaborations: { where: { isActive: true } },
                ownedProjects: true,
                reportsAgainst: true,
              },
            },
          },
        })
      : [],
    fetchProjects ? prisma.project.count({ where: projectWhere }) : 0,
    fetchProjects
      ? prisma.project.findMany({
          where: projectWhere,
          skip,
          take: limitNum,
          orderBy: { [projectSortField]: direction },
          include: {
            owner: {
              select: {
                id: true,
                displayName: true,
                email: true,
                avatarUrl: true,
                isVerified: true,
                identityVerified: true,
              },
            },
            _count: {
              select: {
                collaborators: { where: { isActive: true } },
                applications: true,
                reports: true,
              },
            },
          },
        })
      : [],
    prisma.userProfile.count(),
    prisma.userProfile.count({ where: { openToCollaborate: true } }),
    prisma.project.count({ where: { isDeleted: false } }),
    prisma.project.count({ where: { visibility: "PUBLIC", isDeleted: false } }),
    prisma.report.count({ where: { reportedUserId: { not: null }, status: "OPEN" } }),
    prisma.report.count({ where: { projectId: { not: null }, status: "OPEN" } }),
  ]);

  return {
    summary: {
      totalProfiles: statsTotalUsers,
      totalOpenToCollaborate: statsOpenToCollab,
      totalProjects: statsTotalProjects,
      totalPublicProjects: statsPublicProjects,
      reportedProfilesCount: statsReportedProfiles,
      reportedProjectsCount: statsReportedProjects,
    },
    profiles: fetchProfiles
      ? {
          items: profilesList,
          total: totalProfilesCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalProfilesCount / limitNum),
        }
      : null,
    projects: fetchProjects
      ? {
          items: projectsList,
          total: totalProjectsCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalProjectsCount / limitNum),
        }
      : null,
  };
};

/**
 * Retrieve detailed collaborator profile information.
 * FR: FRA29
 */
const getCollaboratorProfileDetails = async (id) => {
  const profile = await prisma.userProfile.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      legalName: true,
      displayName: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      bio: true,
      experience: true,
      skills: true,
      genres: true,
      portfolioLinks: true,
      socialLinks: true,
      phoneNumber: true,
      openToCollaborate: true,
      isVerified: true,
      identityVerified: true,
      tier: true,
      accountStatus: true,
      lastActiveAt: true,
      createdAt: true,
      updatedAt: true,
      collaborations: {
        orderBy: { createdAt: "desc" },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              genre: true,
              status: true,
              visibility: true,
              owner: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      ownedProjects: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          genre: true,
          status: true,
          visibility: true,
          createdAt: true,
          _count: {
            select: {
              collaborators: true,
              applications: true,
            },
          },
        },
      },
      applications: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      },
      reportsAgainst: {
        orderBy: { createdAt: "desc" },
        include: {
          reporter: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      },
      adminNotes: {
        orderBy: { createdAt: "desc" },
        include: {
          admin: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!profile) {
    throw new Error("Collaborator profile not found");
  }

  return profile;
};

/**
 * Retrieve detailed project listing information.
 * FR: FRA30
 */
const getProjectPostingDetails = async (id) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          displayName: true,
          legalName: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          isVerified: true,
          identityVerified: true,
          tier: true,
        },
      },
      collaborators: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              avatarUrl: true,
              skills: true,
              isVerified: true,
            },
          },
        },
      },
      applications: {
        orderBy: { createdAt: "desc" },
        include: {
          applicant: {
            select: {
              id: true,
              displayName: true,
              email: true,
              avatarUrl: true,
              skills: true,
              genres: true,
              isVerified: true,
            },
          },
        },
      },
      reports: {
        orderBy: { createdAt: "desc" },
        include: {
          reporter: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      },
      adminNotes: {
        orderBy: { createdAt: "desc" },
        include: {
          admin: {
            select: {
              id: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project posting not found");
  }

  // Application Activity Summary
  const applicationStats = {
    total: project.applications.length,
    pending: project.applications.filter((a) => a.status === "PENDING").length,
    accepted: project.applications.filter((a) => a.status === "ACCEPTED").length,
    rejected: project.applications.filter((a) => a.status === "REJECTED").length,
  };

  return {
    ...project,
    applicationActivity: applicationStats,
  };
};

/**
 * Review reports submitted against marketplace content (profiles & postings).
 * FR: FRA31
 */
const getMarketplaceReports = async (filters = {}) => {
  const { page = 1, limit = 10, targetType = "all", status, search } = filters;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (targetType === "profile") {
    where.reportedUserId = { not: null };
  } else if (targetType === "project") {
    where.projectId = { not: null };
  }

  if (status && status !== "All") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { reporter: { email: { contains: search, mode: "insensitive" } } },
      { reporter: { displayName: { contains: search, mode: "insensitive" } } },
      { reportedUser: { displayName: { contains: search, mode: "insensitive" } } },
      { project: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
            avatarUrl: true,
            accountStatus: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            visibility: true,
            isDeleted: true,
          },
        },
      },
    }),
  ]);

  return {
    reports,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Retrieve single report details with reported content context.
 * FR: FRA31
 */
const getMarketplaceReportById = async (reportId) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
        },
      },
      reportedUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
          bio: true,
          skills: true,
          genres: true,
          accountStatus: true,
          openToCollaborate: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          genre: true,
          status: true,
          visibility: true,
          isDeleted: true,
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!report) {
    throw new Error("Report not found");
  }

  return report;
};

/**
 * Update report status after completing an investigation.
 * FR: FRA31
 */
const updateMarketplaceReportStatus = async (adminId, reportId, status) => {
  const validStatuses = ["OPEN", "REVIEWED", "ACTION_TAKEN", "DISMISSED"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid report status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const existingReport = await prisma.report.findUnique({ where: { id: reportId } });
  if (!existingReport) {
    throw new Error("Report not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedReport = await tx.report.update({
      where: { id: reportId },
      data: { status },
      include: {
        reporter: { select: { id: true, displayName: true, email: true } },
        reportedUser: { select: { id: true, displayName: true } },
        project: { select: { id: true, name: true } },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: "MARKETPLACE_REPORT_STATUS_UPDATED",
        targetUserId: existingReport.reportedUserId || null,
        details: {
          reportId,
          previousStatus: existingReport.status,
          newStatus: status,
          targetProjectId: existingReport.projectId || null,
        },
      },
    });

    return updatedReport;
  });

  return result;
};

/**
 * Add an internal administrative note to marketplace content (profile or project).
 * FR: FRA31
 */
const addMarketplaceNote = async (adminId, payload) => {
  const { content, targetUserId, targetProjectId } = payload;

  if (!targetUserId && !targetProjectId) {
    throw new Error("Either targetUserId or targetProjectId must be provided");
  }

  if (targetUserId) {
    const user = await prisma.userProfile.findUnique({ where: { id: targetUserId } });
    if (!user) throw new Error("Target user profile not found");
  }

  if (targetProjectId) {
    const project = await prisma.project.findUnique({ where: { id: targetProjectId } });
    if (!project) throw new Error("Target project posting not found");
  }

  const note = await prisma.adminNote.create({
    data: {
      adminId,
      targetUserId: targetUserId || null,
      targetProjectId: targetProjectId || null,
      content,
    },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: "MARKETPLACE_ADMIN_NOTE_ADDED",
      targetUserId: targetUserId || null,
      details: {
        noteId: note.id,
        targetProjectId: targetProjectId || null,
      },
    },
  });

  return note;
};

/**
 * Moderate a marketplace collaborator profile (Restrict, Remove/Suspend, Restore).
 * FR: FRA32, FRA33 | NFR: NFRA20, NFRA22
 */
const moderateCollaboratorProfile = async (adminId, profileId, payload, ipAddress = null, userAgent = null) => {
  const { action, reason, notifyUser = true } = payload;

  const profile = await prisma.userProfile.findUnique({
    where: { id: profileId },
    select: { id: true, displayName: true, email: true, accountStatus: true, openToCollaborate: true, tokenVersion: true },
  });

  if (!profile) {
    throw new Error("Collaborator profile not found");
  }

  let newStatus = profile.accountStatus;
  let newOpenToCollab = profile.openToCollaborate;
  let shouldInvalidateToken = false;

  switch (action) {
    case "RESTRICT":
      newStatus = "RESTRICTED";
      break;
    case "REMOVE":
    case "SUSPEND":
      newStatus = "SUSPENDED";
      newOpenToCollab = false;
      shouldInvalidateToken = true;
      break;
    case "RESTORE":
      newStatus = "ACTIVE";
      newOpenToCollab = true;
      break;
    default:
      throw new Error("Invalid moderation action for profile");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updateData = {
      accountStatus: newStatus,
      openToCollaborate: newOpenToCollab,
    };
    if (shouldInvalidateToken) {
      updateData.tokenVersion = profile.tokenVersion + 1;
    }

    const updatedProfile = await tx.userProfile.update({
      where: { id: profileId },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        email: true,
        accountStatus: true,
        openToCollaborate: true,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: `MARKETPLACE_PROFILE_${action}`,
        targetUserId: profileId,
        details: {
          actionPerformed: action,
          reason,
          previousStatus: profile.accountStatus,
          newStatus,
          previousOpenToCollaborate: profile.openToCollaborate,
          newOpenToCollaborate: newOpenToCollab,
        },
        ipAddress,
        userAgent,
      },
    });

    if (notifyUser) {
      await tx.notification.create({
        data: {
          userId: profileId,
          title: `Marketplace Profile ${action === "RESTORE" ? "Restored" : "Moderated"}`,
          message: `Your marketplace profile status has been updated to ${newStatus}. Reason: ${reason}`,
          type: "SYSTEM",
        },
      });
    }

    return updatedProfile;
  });

  await publishEvent(EVENT_TYPES.USER_MODERATED, {
    userId: profileId,
    action: `MARKETPLACE_${action}`,
    reason,
  });

  return result;
};

/**
 * Moderate a marketplace project posting (Restrict, Remove, Restore).
 * FR: FRA32, FRA33 | NFR: NFRA20, NFRA22
 */
const moderateProjectPosting = async (adminId, projectId, payload, ipAddress = null, userAgent = null) => {
  const { action, reason, notifyOwner = true } = payload;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, displayName: true, email: true } },
      collaborators: { where: { isActive: true }, select: { userId: true } },
    },
  });

  if (!project) {
    throw new Error("Project posting not found");
  }

  let updateData = {};
  switch (action) {
    case "RESTRICT":
      updateData = { openToCollaborators: false };
      break;
    case "REMOVE":
      updateData = { isDeleted: true, openToCollaborators: false };
      break;
    case "RESTORE":
      updateData = { isDeleted: false, openToCollaborators: true };
      break;
    default:
      throw new Error("Invalid moderation action for project posting");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedProject = await tx.project.update({
      where: { id: projectId },
      data: updateData,
      select: {
        id: true,
        name: true,
        visibility: true,
        status: true,
        isDeleted: true,
        openToCollaborators: true,
        ownerId: true,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: `MARKETPLACE_PROJECT_${action}`,
        targetUserId: project.ownerId,
        details: {
          targetProjectId: projectId,
          projectName: project.name,
          actionPerformed: action,
          reason,
          previousState: {
            isDeleted: project.isDeleted,
            openToCollaborators: project.openToCollaborators,
          },
          newState: {
            isDeleted: updatedProject.isDeleted,
            openToCollaborators: updatedProject.openToCollaborators,
          },
        },
        ipAddress,
        userAgent,
      },
    });

    if (notifyOwner) {
      const notifications = [
        {
          userId: project.ownerId,
          title: `Project Posting ${action === "RESTORE" ? "Restored" : "Moderated"}`,
          message: `Your project posting "${project.name}" has been ${
            action === "RESTORE" ? "restored" : action.toLowerCase() + "d"
          } by moderation. Reason: ${reason}`,
          type: "SYSTEM",
        },
      ];

      project.collaborators.forEach((collab) => {
        if (collab.userId !== project.ownerId) {
          notifications.push({
            userId: collab.userId,
            title: `Project Posting ${action === "RESTORE" ? "Restored" : "Moderated"}`,
            message: `The project "${project.name}" has been ${
              action === "RESTORE" ? "restored" : action.toLowerCase() + "d"
            } by moderation.`,
            type: "SYSTEM",
          });
        }
      });

      await tx.notification.createMany({
        data: notifications,
      });
    }

    return updatedProject;
  });

  await publishEvent(EVENT_TYPES.PROJECT_UPDATED, {
    projectId,
    action: `MARKETPLACE_${action}`,
    reason,
  });

  return result;
};

/**
 * View marketplace audit history (chronological, immutable).
 * FR: FRA34, FRA35 | NFR: NFRA22
 */
const getMarketplaceAuditHistory = async (query = {}) => {
  const { page = 1, limit = 10, search, targetType = "all" } = query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = {
    action: { startsWith: "MARKETPLACE_" },
  };

  if (targetType === "profile") {
    where.action = { in: ["MARKETPLACE_PROFILE_RESTRICT", "MARKETPLACE_PROFILE_REMOVE", "MARKETPLACE_PROFILE_SUSPEND", "MARKETPLACE_PROFILE_RESTORE"] };
  } else if (targetType === "project") {
    where.action = { in: ["MARKETPLACE_PROJECT_RESTRICT", "MARKETPLACE_PROJECT_REMOVE", "MARKETPLACE_PROJECT_RESTORE"] };
  }

  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { admin: { email: { contains: search, mode: "insensitive" } } },
      { targetUser: { displayName: { contains: search, mode: "insensitive" } } },
      { targetUser: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, auditLogs] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        targetUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    auditLogs,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

module.exports = {
  getMarketplaceListings,
  getCollaboratorProfileDetails,
  getProjectPostingDetails,
  getMarketplaceReports,
  getMarketplaceReportById,
  updateMarketplaceReportStatus,
  addMarketplaceNote,
  moderateCollaboratorProfile,
  moderateProjectPosting,
  getMarketplaceAuditHistory,
};
