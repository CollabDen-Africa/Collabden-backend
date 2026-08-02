const prisma = require("../../../config/prismaClient");

const getProjects = async (filters = {}) => {
  const { page = 1, limit = 10, search, status, visibility, genre } = filters;
  const skip = (page - 1) * limit;

  const where = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (visibility) {
    where.visibility = visibility;
  }

  if (genre) {
    where.genre = { contains: genre, mode: "insensitive" };
  }

  const [total, projects, statsTotal, statsActive, statsCompleted, statsArchived] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          }
        },
        _count: {
          select: {
            collaborators: { where: { isActive: true } }
          }
        }
      }
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
    }
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
        }
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
            }
          }
        }
      },
      _count: {
        select: {
          tasks: true,
          files: true,
          messages: true,
          agreements: true,
          reports: true,
        }
      }
    }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return project;
};

const getProjectActivity = async (id, query = {}) => {
  const { page = 1, limit = 10, search, type } = query;
  const skip = (page - 1) * limit;

  const where = { projectId: id };
  
  if (type && type !== "All") {
    where.action = { contains: type, mode: 'insensitive' };
  }
  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { details: { contains: search, mode: "insensitive" } }
    ];
  }

  const [total, activities] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    })
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
    where.reason = { contains: type, mode: 'insensitive' };
  }
  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } }
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
            avatarUrl: true
          }
        }
      }
    })
  ]);

  return {
    reports,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const updateProjectReportStatus = async (reportId, status) => {
  const validStatuses = ["OPEN", "REVIEWED", "ACTION_TAKEN", "DISMISSED"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const report = await prisma.report.update({
    where: { id: reportId },
    data: { status }
  });

  return report;
};

const getAllProjectReports = async (filters = {}) => {
  const { page = 1, limit = 10, search, status } = filters;
  const skip = (page - 1) * limit;

  const where = {};
  
  if (status && status !== "All") {
    // Map UI statuses to DB statuses
    // UI: 'Pending', 'Under Review', 'Resolved'
    if (status === 'Pending') {
      where.status = 'OPEN';
    } else if (status === 'Under Review') {
      where.status = 'REVIEWED';
    } else if (status === 'Resolved') {
      where.status = { in: ['ACTION_TAKEN', 'DISMISSED'] };
    }
  }

  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { project: { name: { contains: search, mode: "insensitive" } } }
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
            avatarUrl: true
          }
        },
        project: {
          select: {
            id: true,
            name: true,
            genre: true
          }
        }
      }
    })
  ]);

  return {
    reports,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const getProjectNotes = async (id, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where = {
    targetProjectId: id
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
            role: true
          }
        }
      }
    })
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
  return await prisma.adminNote.create({
    data: {
      adminId,
      targetProjectId,
      content
    },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          role: true
        }
      }
    }
  });
};

const getProjectAuditHistory = async (id, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  // We look for AdminAuditLog where details.targetProjectId matches
  // Unfortunately Prisma's JSON filtering for findMany is somewhat limited,
  // but we can do a path query if it's supported, or stringify.
  // Actually, string contains is possible with path in PostgreSQL, but 
  // since it's Prisma we can just use path if supported, or fetch and filter if small,
  // Or better, Prisma supports filtering JSON fields for exact match using equals.
  const where = {
    details: {
      path: ['targetProjectId'],
      equals: id,
    }
  };

  const [total, audits] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    })
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
  const { actionType, reason, additionalNotes, notifyOwner } = payload;
  
  // Start a transaction to ensure project soft-delete and audit log creation are atomic
  const result = await prisma.$transaction(async (tx) => {
    // 1. Soft-delete the project (for both ARCHIVE and REMOVE, as requested)
    const updatedProject = await tx.project.update({
      where: { id: projectId },
      data: { isDeleted: true },
      include: {
        owner: true,
        collaborators: true
      }
    });

    // 2. Create Audit Log
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: actionType === 'ARCHIVE' ? 'PROJECT_ARCHIVED' : 'PROJECT_REMOVED',
        details: {
          targetProjectId: projectId,
          reason,
          additionalNotes,
          notifyOwner
        }
      }
    });

    // 3. (Optional) Create Notifications if notifyOwner is true
    if (notifyOwner) {
      const notifications = [];
      // Notify Owner
      if (updatedProject.ownerId) {
        notifications.push({
          userId: updatedProject.ownerId,
          title: `Project ${actionType === 'ARCHIVE' ? 'Archived' : 'Removed'}`,
          message: `Your project "${updatedProject.name}" has been ${actionType === 'ARCHIVE' ? 'archived' : 'removed'} by moderation. Reason: ${reason}`,
          type: 'SYSTEM'
        });
      }
      // Notify Collaborators
      if (updatedProject.collaborators && updatedProject.collaborators.length > 0) {
        updatedProject.collaborators.forEach(collab => {
          if (collab.isActive && collab.userId !== updatedProject.ownerId) {
            notifications.push({
              userId: collab.userId,
              title: `Project ${actionType === 'ARCHIVE' ? 'Archived' : 'Removed'}`,
              message: `A project you were collaborating on ("${updatedProject.name}") has been ${actionType === 'ARCHIVE' ? 'archived' : 'removed'} by moderation.`,
              type: 'SYSTEM'
            });
          }
        });
      }
      
      if (notifications.length > 0) {
        await tx.notification.createMany({
          data: notifications
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
  updateProjectReportStatus,
  getProjectNotes,
  addProjectNote,
  getProjectAuditHistory,
  moderateProject,
};
