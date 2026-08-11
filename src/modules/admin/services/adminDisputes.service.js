const prisma = require("../../../config/prismaClient");

/**
 * Retrieve disputes with pagination, search, filtering, and stats summary
 */
const getDisputes = async (filters = {}) => {
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

  // Search across dispute ID, reason, description, reporter name/email, reported user name/email, project name
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { reason: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { reporter: { displayName: { contains: search, mode: "insensitive" } } },
      { reporter: { email: { contains: search, mode: "insensitive" } } },
      { reportedUser: { displayName: { contains: search, mode: "insensitive" } } },
      { reportedUser: { email: { contains: search, mode: "insensitive" } } },
      { project: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Filter by status
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

  // Sorting setup
  const allowedSortFields = ["createdAt", "status", "reason"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";
  const orderBy = { [sortField]: direction };

  const [
    total,
    disputes,
    statsTotal,
    statsOpen,
    statsUnderReview,
    statsAwaitingResponse,
    statsResolved,
    statsClosed,
  ] = await Promise.all([
    prisma.dispute.count({ where }),
    prisma.dispute.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy,
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
        reportedUser: {
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
            status: true,
          },
        },
        _count: {
          select: {
            adminNotes: true,
          },
        },
      },
    }),
    prisma.dispute.count(),
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.dispute.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.dispute.count({ where: { status: "AWAITING_RESPONSE" } }),
    prisma.dispute.count({ where: { status: "RESOLVED" } }),
    prisma.dispute.count({ where: { status: "CLOSED" } }),
  ]);

  return {
    disputes,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats: {
      totalDisputes: statsTotal,
      open: statsOpen,
      underReview: statsUnderReview,
      awaitingResponse: statsAwaitingResponse,
      resolved: statsResolved,
      closed: statsClosed,
    },
  };
};

/**
 * Retrieve comprehensive details for a dispute, including payment records, escrow details,
 * legal agreements, project activity history, and communication records.
 */
const getDisputeById = async (id) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id },
    include: {
      reporter: {
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
      reportedUser: {
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
              email: true,
            },
          },
          collaborators: {
            where: { isActive: true },
            select: {
              id: true,
              role: true,
              user: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                },
              },
            },
          },
          escrow: {
            include: {
              milestones: true,
              allocations: true,
              activities: {
                orderBy: { createdAt: "desc" },
                take: 10,
              },
            },
          },
          agreements: {
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
          activities: {
            orderBy: { createdAt: "desc" },
            take: 20,
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

  if (!dispute) {
    throw new Error("Dispute not found");
  }

  // Fetch payment records related to reporter and reported user
  const userIds = [dispute.reporterId, dispute.reportedUserId].filter(Boolean);
  const paymentRecords = await prisma.paymentRecord.findMany({
    where: {
      userId: { in: userIds },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userId: true,
      txRef: true,
      flwRef: true,
      amount: true,
      currency: true,
      status: true,
      type: true,
      createdAt: true,
    },
  });

  return {
    ...dispute,
    investigationData: {
      paymentRecords,
      escrow: dispute.project?.escrow || null,
      agreements: dispute.project?.agreements || [],
      projectActivities: dispute.project?.activities || [],
    },
  };
};

/**
 * Add an internal administrative note to a dispute
 */
const addDisputeNote = async (adminId, disputeId, content) => {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  return await prisma.adminNote.create({
    data: {
      adminId,
      targetDisputeId: disputeId,
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

/**
 * Get internal notes for a dispute
 */
const getDisputeNotes = async (disputeId, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where = { targetDisputeId: disputeId };

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

/**
 * Update dispute status and record audit log
 */
const updateDisputeStatus = async (adminId, disputeId, status) => {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  const updatedDispute = await prisma.$transaction(async (tx) => {
    const updated = await tx.dispute.update({
      where: { id: disputeId },
      data: { status },
      include: {
        reporter: {
          select: { id: true, displayName: true, email: true },
        },
        reportedUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    // Record audit log
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: "DISPUTE_STATUS_UPDATED",
        details: {
          disputeId,
          previousStatus: dispute.status,
          newStatus: status,
        },
      },
    });

    return updated;
  });

  return updatedDispute;
};

module.exports = {
  getDisputes,
  getDisputeById,
  addDisputeNote,
  getDisputeNotes,
  updateDisputeStatus,
};
