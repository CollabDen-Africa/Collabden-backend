const prisma = require("../../../config/prismaClient");

/**
 * Get all transactions with search, filtering, sorting, and pagination
 */
const getTransactions = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    type,
    status,
    dateStart,
    dateEnd,
    userId,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};

  // Search across transaction ID, reference, user name, email
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { reference: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { user: { displayName: { contains: search, mode: "insensitive" } } },
      { user: { firstName: { contains: search, mode: "insensitive" } } },
      { user: { lastName: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Filter by transaction type
  if (type && type !== "All") {
    where.type = type.toUpperCase();
  }

  // Filter by transaction status
  if (status && status !== "All") {
    where.status = status.toUpperCase();
  }

  // Filter by user
  if (userId) {
    where.userId = userId;
  }

  // Filter by date range
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
  const allowedSortFields = ["createdAt", "amount", "type", "status"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";
  const orderBy = { [sortField]: direction };

  const [
    total,
    transactions,
    statsTotal,
    statsPending,
    statsCompleted,
    statsFailed,
  ] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy,
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
    }),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { status: "PENDING" } }),
    prisma.transaction.count({ where: { status: "COMPLETED" } }),
    prisma.transaction.count({ where: { status: "FAILED" } }),
  ]);

  return {
    transactions,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats: {
      totalTransactions: statsTotal,
      pending: statsPending,
      completed: statsCompleted,
      failed: statsFailed,
    },
  };
};

/**
 * Get a single transaction by ID with full details
 */
const getTransactionById = async (id) => {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      user: {
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
    },
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  // Try to find associated PaymentRecord for provider reference
  const paymentRecord = await prisma.paymentRecord.findFirst({
    where: {
      OR: [
        { txRef: transaction.reference },
        { txRef: { contains: transaction.reference } },
      ],
    },
    select: {
      id: true,
      txRef: true,
      flwRef: true,
      paymentMethod: true,
      type: true,
      status: true,
      flutterwaveData: true,
    },
  });

  return {
    ...transaction,
    paymentRecord: paymentRecord || null,
  };
};

module.exports = {
  getTransactions,
  getTransactionById,
};
