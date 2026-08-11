const prisma = require("../../../config/prismaClient");

/**
 * Generate filtered payment reports for administrative review and financial tracking
 */
const generatePaymentReport = async (filters = {}) => {
  const {
    dateStart,
    dateEnd,
    type,
    status,
    page = 1,
    limit = 20,
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};

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

  // Payment type filter
  if (type && type !== "All") {
    where.type = type.toUpperCase();
  }

  // Transaction status filter
  if (status && status !== "All") {
    where.status = status.toUpperCase();
  }

  // Aggregate transaction metrics using Prisma aggregate and groupBy
  const [
    totalCount,
    volumeAggregate,
    byTypeGroup,
    byStatusGroup,
    transactions,
  ] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.aggregate({
      where,
      _sum: {
        amount: true,
      },
      _avg: {
        amount: true,
      },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where,
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.transaction.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: {
        user: {
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
    reportMetadata: {
      generatedAt: new Date(),
      filtersApplied: {
        dateStart: dateStart || null,
        dateEnd: dateEnd || null,
        type: type || "All",
        status: status || "All",
      },
    },
    summary: {
      totalTransactions: totalCount,
      totalVolume: volumeAggregate._sum.amount || 0,
      averageAmount: volumeAggregate._avg.amount || 0,
      breakdownByType: byTypeGroup.map((g) => ({
        type: g.type,
        count: g._count._all,
        totalAmount: g._sum.amount || 0,
      })),
      breakdownByStatus: byStatusGroup.map((g) => ({
        status: g.status,
        count: g._count._all,
        totalAmount: g._sum.amount || 0,
      })),
    },
    transactions,
    pagination: {
      total: totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

/**
 * Retrieve read-only audit log history for payment and escrow administrative actions
 */
const getPaymentAuditHistory = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    adminId,
    dateStart,
    dateEnd,
  } = filters;

  const skip = (page - 1) * limit;

  // Filter audit logs to payment, escrow, and dispute actions
  const paymentActions = [
    "DISPUTE_STATUS_UPDATED",
    "ESCROW_APPROVED",
    "ESCROW_FUNDED",
    "ESCROW_PAYMENT_RELEASED",
    "WITHDRAWAL_INITIATED",
    "WITHDRAWAL_COMPLETED",
    "PAYMENT_REPORT_GENERATED",
  ];

  const where = {
    OR: [
      { action: { in: paymentActions } },
      { action: { contains: "PAYMENT", mode: "insensitive" } },
      { action: { contains: "ESCROW", mode: "insensitive" } },
      { action: { contains: "DISPUTE", mode: "insensitive" } },
      { action: { contains: "WITHDRAWAL", mode: "insensitive" } },
    ],
  };

  if (search) {
    where.AND = [
      {
        OR: [
          { action: { contains: search, mode: "insensitive" } },
          { admin: { email: { contains: search, mode: "insensitive" } } },
        ],
      },
    ];
  }

  if (adminId) {
    where.adminId = adminId;
  }

  if (dateStart || dateEnd) {
    where.createdAt = {};
    if (dateStart) {
      where.createdAt.gte = new Date(dateStart);
    }
    if (dateEnd) {
      where.createdAt.lte = new Date(dateEnd);
    }
  }

  const [total, auditLogs] = await Promise.all([
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
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

module.exports = {
  generatePaymentReport,
  getPaymentAuditHistory,
};
