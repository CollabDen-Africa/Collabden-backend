const { 
  AccountStatus, 
  ProjectStatus, 
  SupportTicketStatus, 
  IdentityVerificationStatus, 
  DisputeStatus, 
  ReportStatus 
} = require("@prisma/client");
const prisma = require("../../../config/prismaClient");

const getUserDashboardData = async (userId) => {
  const activeProjects = await prisma.project.findMany({
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

  const notifications = await prisma.notification.findMany({
    where: {
      userId: userId,
      isRead: false,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    activeProjects,
    notifications,
  };
};

const getAdminDashboardData = async () => {
  const [
    totalUsers,
    activeUsers,
    totalProjects,
    activeProjects,
    openTickets,
    identityVerificationRequests,
    openDisputes,
    reportedItems
  ] = await Promise.all([
    prisma.userProfile.count(),
    prisma.userProfile.count({ where: { accountStatus: AccountStatus.ACTIVE } }),
    prisma.project.count({ where: { isDeleted: false } }),
    prisma.project.count({ where: { status: ProjectStatus.ACTIVE, isDeleted: false } }),
    prisma.supportTicket.count({ where: { status: SupportTicketStatus.OPEN } }),
    prisma.identityVerificationRequest.count({ where: { status: IdentityVerificationStatus.PENDING } }),
    prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
    prisma.report.count({ where: { status: ReportStatus.OPEN } }),
  ]);

  return {
    totalUsers,
    activeUsers,
    totalProjects,
    activeProjects,
    pendingActions: {
      identityVerificationRequests,
      openDisputes,
      supportTickets: openTickets,
      reportedItems,
    }
  };
};

module.exports = {
  getUserDashboardData,
  getAdminDashboardData,
};

