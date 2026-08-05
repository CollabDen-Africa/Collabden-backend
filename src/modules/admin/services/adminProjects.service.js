const prisma = require("../../../config/prismaClient");

const getProjects = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    visibility,
    genre,
    dateCreatedStart,
    dateCreatedEnd,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};

  // Handling Search across name, description, ID, owner name, owner email
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
      { owner: { displayName: { contains: search, mode: "insensitive" } } },
      { owner: { firstName: { contains: search, mode: "insensitive" } } },
      { owner: { lastName: { contains: search, mode: "insensitive" } } },
      { owner: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Handling Status filter (ACTIVE, COMPLETED, ARCHIVED/REMOVED)
  if (status && status !== "All") {
    const upperStatus = status.toUpperCase();
    if (upperStatus === "ARCHIVED" || upperStatus === "REMOVED" || upperStatus === "DELETED") {
      where.isDeleted = true;
    } else if (upperStatus === "ACTIVE" || upperStatus === "COMPLETED") {
      where.status = upperStatus;
      where.isDeleted = false;
    }
  }

  // Handling Visibility filter (PUBLIC, PRIVATE)
  if (visibility && visibility !== "All") {
    where.visibility = visibility.toUpperCase();
  }

  // Handling Genre filter
  if (genre && genre !== "All") {
    where.genre = { contains: genre, mode: "insensitive" };
  }

  // Handling Date range filter
  if (dateCreatedStart || dateCreatedEnd) {
    where.createdAt = {};
    if (dateCreatedStart) {
      where.createdAt.gte = new Date(dateCreatedStart);
    }
    if (dateCreatedEnd) {
      where.createdAt.lte = new Date(dateCreatedEnd);
    }
  }

  // Sorting setup
  const allowedSortFields = ["createdAt", "name", "status", "visibility", "updatedAt"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";
  const orderBy = { [sortField]: direction };

  const [total, projects, statsTotal, statsActive, statsCompleted, statsArchived] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy,
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            tier: true,
            isVerified: true,
          },
        },
        _count: {
          select: {
            collaborators: { where: { isActive: true } },
            tasks: true,
            files: true,
            agreements: true,
            reports: true,
          },
        },
      },
    }),
    prisma.project.count({ where: { isDeleted: false } }),
    prisma.project.count({ where: { isDeleted: false, status: "ACTIVE" } }),
    prisma.project.count({ where: { isDeleted: false, status: "COMPLETED" } }),
    prisma.project.count({ where: { isDeleted: true } }),
  ]);

  return {
    projects,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats: {
      totalProjects: statsTotal,
      active: statsActive,
      completed: statsCompleted,
      archived: statsArchived,
    },
  };
};

const getProjectById = async (id) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          tier: true,
          isVerified: true,
          identityVerified: true,
        },
      },
      collaborators: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      escrow: {
        select: {
          id: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          milestones: {
            select: {
              id: true,
              title: true,
              amount: true,
              status: true,
              dueDate: true,
            },
          },
        },
      },
      _count: {
        select: {
          tasks: true,
          files: true,
          messages: true,
          agreements: true,
          reports: true,
          applications: true,
        },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Calculate task progress metrics
  const [completedTasksCount, totalTasksCount] = await Promise.all([
    prisma.projectTask.count({ where: { projectId: id, status: "COMPLETED" } }),
    prisma.projectTask.count({ where: { projectId: id } }),
  ]);

  const progressPercentage = totalTasksCount > 0 
    ? Math.round((completedTasksCount / totalTasksCount) * 100) 
    : 0;

  return {
    ...project,
    progress: {
      completedTasks: completedTasksCount,
      totalTasks: totalTasksCount,
      percentage: progressPercentage,
    },
  };
};

const getProjectActivity = async (id, query = {}) => {
  const { page = 1, limit = 10, search, type } = query;
  const skip = (page - 1) * limit;

  const where = { projectId: id };

  if (type && type !== "All") {
    where.action = { contains: type, mode: "insensitive" };
  }

  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { details: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, activities] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    activities,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const getProjectReports = async (id, query = {}) => {
  const { page = 1, limit = 10, search, type } = query;
  const skip = (page - 1) * limit;

  const where = { projectId: id };

  if (type && type !== "All") {
    where.reason = { contains: type, mode: "insensitive" };
  }

  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    }),
  ]);

  return {
    reports,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const getAllProjectReports = async (filters = {}) => {
  const { page = 1, limit = 10, search, status } = filters;
  const skip = (page - 1) * limit;

  const where = {};

  if (status && status !== "All") {
    if (status === "Pending" || status === "OPEN") {
      where.status = "OPEN";
    } else if (status === "Under Review" || status === "REVIEWED") {
      where.status = "REVIEWED";
    } else if (status === "Resolved" || status === "ACTION_TAKEN") {
      where.status = "ACTION_TAKEN";
    } else if (status === "DISMISSED") {
      where.status = "DISMISSED";
    } else {
      where.status = status;
    }
  }

  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { project: { name: { contains: search, mode: "insensitive" } } },
      { reporter: { email: { contains: search, mode: "insensitive" } } },
      { reporter: { displayName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: {
        reporter: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            genre: true,
            visibility: true,
            status: true,
            isDeleted: true,
          },
        },
      },
    }),
  ]);

  return {
    reports,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const getReportById = async (reportId) => {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          genre: true,
          visibility: true,
          status: true,
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

const updateProjectReportStatus = async (reportId, status) => {
  const validStatuses = ["OPEN", "REVIEWED", "ACTION_TAKEN", "DISMISSED"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const existingReport = await prisma.report.findUnique({ where: { id: reportId } });
  if (!existingReport) {
    throw new Error("Report not found");
  }

  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status },
    include: {
      reporter: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return report;
};

const getProjectNotes = async (id, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where = {
    targetProjectId: id,
  };

  const [total, notes] = await Promise.all([
    prisma.adminNote.count({ where }),
    prisma.adminNote.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
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
    }),
  ]);

  return {
    notes,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const addProjectNote = async (adminId, targetProjectId, content) => {
  const project = await prisma.project.findUnique({ where: { id: targetProjectId } });
  if (!project) {
    throw new Error("Project not found");
  }

  return await prisma.adminNote.create({
    data: {
      adminId,
      targetProjectId,
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
};

const getProjectAuditHistory = async (id, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where = {
    details: {
      path: ["targetProjectId"],
      equals: id,
    },
  };

  const [total, audits] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
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
    }),
  ]);

  return {
    audits,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const moderateProject = async (adminId, projectId, payload) => {
  const { actionType, reason, additionalNotes, notifyOwner = true } = payload;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: true,
      collaborators: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update Project (soft-delete isDeleted = true)
    const updatedProject = await tx.project.update({
      where: { id: projectId },
      data: { isDeleted: true },
      include: {
        owner: true,
        collaborators: true,
      },
    });

    // 2. Log Admin Audit Action
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: actionType === "ARCHIVE" ? "PROJECT_ARCHIVED" : "PROJECT_REMOVED",
        details: {
          targetProjectId: projectId,
          projectName: project.name,
          reason,
          additionalNotes: additionalNotes || null,
          notifyOwner,
        },
      },
    });

    // 3. Notify Owner and Collaborators if notifyOwner is true
    if (notifyOwner) {
      const notifications = [];
      if (updatedProject.ownerId) {
        notifications.push({
          userId: updatedProject.ownerId,
          title: `Project ${actionType === "ARCHIVE" ? "Archived" : "Removed"}`,
          message: `Your project "${updatedProject.name}" has been ${
            actionType === "ARCHIVE" ? "archived" : "removed"
          } by moderation. Reason: ${reason}`,
          type: "SYSTEM",
        });
      }

      if (updatedProject.collaborators && updatedProject.collaborators.length > 0) {
        updatedProject.collaborators.forEach((collab) => {
          if (collab.isActive && collab.userId !== updatedProject.ownerId) {
            notifications.push({
              userId: collab.userId,
              title: `Project ${actionType === "ARCHIVE" ? "Archived" : "Removed"}`,
              message: `A project you were collaborating on ("${updatedProject.name}") has been ${
                actionType === "ARCHIVE" ? "archived" : "removed"
              } by moderation.`,
              type: "SYSTEM",
            });
          }
        });
      }

      if (notifications.length > 0) {
        await tx.notification.createMany({
          data: notifications,
        });
      }
    }

    return updatedProject;
  });

  return result;
};

module.exports = {
  getProjects,
  getProjectById,
  getProjectActivity,
  getProjectReports,
  getAllProjectReports,
  getReportById,
  updateProjectReportStatus,
  getProjectNotes,
  addProjectNote,
  getProjectAuditHistory,
  moderateProject,
};
