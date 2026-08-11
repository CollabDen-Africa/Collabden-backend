const prisma = require("../../../config/prismaClient");

/**
 * Retrieve escrow records with pagination, search, filtering, and status summary
 */
const getEscrows = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    dateStart,
    dateEnd,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};

  // Search by project name, project ID, funding reference, or owner email/name
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { fundingReference: { contains: search, mode: "insensitive" } },
      { project: { name: { contains: search, mode: "insensitive" } } },
      { project: { owner: { displayName: { contains: search, mode: "insensitive" } } } },
      { project: { owner: { email: { contains: search, mode: "insensitive" } } } },
    ];
  }

  // Filter by Escrow status
  if (status && status !== "All") {
    where.status = status.toUpperCase();
  }

  // Date range filter
  if (dateStart || dateEnd) {
    where.createdAt = {};
    if (dateStart) {
      where.createdAt.gte = new Date(dateStart);
    }
    if (dateEnd) {
      where.createdAt.lte = new Date(dateEnd);
    }
  }

  // Sorting
  const allowedSortFields = ["createdAt", "totalAmount", "fundedAmount", "releasedAmount", "status"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";
  const orderBy = { [sortField]: direction };

  const [
    total,
    escrows,
    statsTotal,
    statsPendingFunding,
    statsFunded,
    statsLocked,
    statsCompleted,
  ] = await Promise.all([
    prisma.escrow.count({ where }),
    prisma.escrow.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            genre: true,
            status: true,
            owner: {
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
        _count: {
          select: {
            milestones: true,
            allocations: true,
            activities: true,
          },
        },
      },
    }),
    prisma.escrow.count(),
    prisma.escrow.count({ where: { status: "PENDING_FUNDING" } }),
    prisma.escrow.count({ where: { status: "FUNDED" } }),
    prisma.escrow.count({ where: { status: "LOCKED" } }),
    prisma.escrow.count({ where: { status: "COMPLETED" } }),
  ]);

  return {
    escrows,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats: {
      totalEscrows: statsTotal,
      pendingFunding: statsPendingFunding,
      funded: statsFunded,
      locked: statsLocked,
      completed: statsCompleted,
    },
  };
};

/**
 * Retrieve complete details for a specific escrow record by Escrow ID or Project ID
 */
const getEscrowById = async (id) => {
  // Support lookup by either Escrow ID or Project ID
  let escrow = await prisma.escrow.findFirst({
    where: {
      OR: [{ id }, { projectId: id }],
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          genre: true,
          status: true,
          startDate: true,
          endDate: true,
          owner: {
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
      agreement: {
        select: {
          id: true,
          title: true,
          status: true,
          fileUrl: true,
          createdAt: true,
          signatures: {
            select: {
              id: true,
              userId: true,
              legalName: true,
              signedAt: true,
            },
          },
        },
      },
      allocations: {
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
      milestones: {
        orderBy: { createdAt: "asc" },
        include: {
          collaborators: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!escrow) {
    throw new Error("Escrow record not found");
  }

  return escrow;
};

module.exports = {
  getEscrows,
  getEscrowById,
};
