const { 
  AccountStatus, 
  ProjectStatus, 
  SupportTicketStatus, 
  IdentityVerificationStatus, 
  DisputeStatus, 
  ReportStatus,
  AdminRole
} = require("@prisma/client");
const prisma = require("../../../config/prismaClient");

const getUserActiveProjects = async (userId) => {
  return await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          collaborators: {
            some: { 
              userId: userId,
              isActive: true
            },
          },
        },
      ],
      status: ProjectStatus.ACTIVE,
    },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
};

const getUserNotifications = async (userId) => {
  return await prisma.notification.findMany({
    where: {
      userId: userId,
      isRead: false,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
};

const getAdminUserStats = async (admin) => {
  const role = admin.role;
  if (role === AdminRole.SUPER_ADMIN || role === AdminRole.SUPPORT_ADMIN) {
    const [totalUsers, activeUsers] = await Promise.all([
      prisma.userProfile.count(),
      prisma.userProfile.count({ where: { accountStatus: AccountStatus.ACTIVE } }),
    ]);
    return { totalUsers, activeUsers };
  }
  return {};
};

const getAdminProjectStats = async (admin) => {
  const role = admin.role;
  if (role === AdminRole.SUPER_ADMIN || role === AdminRole.MARKETPLACE_MODERATOR) {
    const [totalProjects, activeProjects] = await Promise.all([
      prisma.project.count({ where: { isDeleted: false } }),
      prisma.project.count({ where: { status: ProjectStatus.ACTIVE, isDeleted: false } }),
    ]);
    return { totalProjects, activeProjects };
  }
  return {};
};

const getAdminPendingStats = async (admin) => {
  const role = admin.role;
  let data = {};

  switch (role) {
    case AdminRole.SUPER_ADMIN: {
      const [
        identityVerificationRequests,
        openDisputes,
        supportTickets,
        reportedItems
      ] = await Promise.all([
        prisma.identityVerificationRequest.count({ where: { status: IdentityVerificationStatus.PENDING } }),
        prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
        prisma.supportTicket.count({ where: { status: SupportTicketStatus.OPEN } }),
        prisma.report.count({ where: { status: ReportStatus.OPEN } }),
      ]);
      data = {
        identityVerificationRequests,
        openDisputes,
        supportTickets,
        reportedItems,
      };
      break;
    }
    case AdminRole.SUPPORT_ADMIN: {
      const supportTickets = await prisma.supportTicket.count({ where: { status: SupportTicketStatus.OPEN } });
      data = { supportTickets };
      break;
    }
    case AdminRole.FINANCE_ADMIN: {
      const openDisputes = await prisma.dispute.count({ where: { status: DisputeStatus.OPEN } });
      data = { openDisputes };
      break;
    }
    case AdminRole.VERIFICATION_ADMIN: {
      const identityVerificationRequests = await prisma.identityVerificationRequest.count({ where: { status: IdentityVerificationStatus.PENDING } });
      data = { identityVerificationRequests };
      break;
    }
    case AdminRole.MARKETPLACE_MODERATOR: {
      const reportedItems = await prisma.report.count({ where: { status: ReportStatus.OPEN } });
      data = { reportedItems };
      break;
    }
  }
  return data;
};

// Kept for backward compatibility
const getUserDashboardData = async (userId) => {
  const [activeProjects, notifications] = await Promise.all([
    getUserActiveProjects(userId),
    getUserNotifications(userId)
  ]);
  return { activeProjects, notifications };
};

const getAdminDashboardData = async (admin) => {
  const [userStats, projectStats, pendingStats] = await Promise.all([
    getAdminUserStats(admin),
    getAdminProjectStats(admin),
    getAdminPendingStats(admin)
  ]);
  return {
    ...userStats,
    ...projectStats,
    pendingActions: pendingStats
  };
};

const getRecentActivities = async (limit = 10) => {
  const activities = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  return activities;
};

const getPendingActions = async (admin) => {
  const role = admin.role;
  let data = {};

  switch (role) {
    case AdminRole.SUPER_ADMIN: {
      const [
        identityVerificationRequests,
        openDisputes,
        supportTickets,
        reportedItems,
      ] = await Promise.all([
        prisma.identityVerificationRequest.findMany({ where: { status: IdentityVerificationStatus.PENDING }, take: 20 }),
        prisma.dispute.findMany({ where: { status: DisputeStatus.OPEN }, take: 20 }),
        prisma.supportTicket.findMany({ where: { status: SupportTicketStatus.OPEN }, take: 20 }),
        prisma.report.findMany({ where: { status: ReportStatus.OPEN }, take: 20 }),
      ]);

      data = {
        identityVerificationRequests,
        openDisputes,
        supportTickets,
        reportedItems,
      };
      break;
    }
    case AdminRole.SUPPORT_ADMIN: {
      const supportTickets = await prisma.supportTicket.findMany({ where: { status: SupportTicketStatus.OPEN }, take: 20 });
      data = { supportTickets };
      break;
    }
    case AdminRole.FINANCE_ADMIN: {
      const openDisputes = await prisma.dispute.findMany({ where: { status: DisputeStatus.OPEN }, take: 20 });
      data = { openDisputes };
      break;
    }
    case AdminRole.VERIFICATION_ADMIN: {
      const identityVerificationRequests = await prisma.identityVerificationRequest.findMany({ where: { status: IdentityVerificationStatus.PENDING }, take: 20 });
      data = { identityVerificationRequests };
      break;
    }
    case AdminRole.MARKETPLACE_MODERATOR: {
      const reportedItems = await prisma.report.findMany({ where: { status: ReportStatus.OPEN }, take: 20 });
      data = { reportedItems };
      break;
    }
    default:
      data = {};
      break;
  }

  return data;
};

module.exports = {
  getUserDashboardData,
  getAdminDashboardData,
  getUserActiveProjects,
  getUserNotifications,
  getAdminUserStats,
  getAdminProjectStats,
  getAdminPendingStats,
  getRecentActivities,
  getPendingActions,
};


