const prisma = require("../../../config/prismaClient");

const getUserDashboardData = async (userId) => {
  const activeProjects = await prisma.project.findMany({
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

module.exports = {
  getUserDashboardData,
};
