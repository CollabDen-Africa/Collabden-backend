const prisma = require("../../../config/prismaClient");

/**
 * Retrieve withdrawal requests and processing status
 */
const getWithdrawals = async (filters = {}) => {
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

  // Withdrawals are tracked as PaymentRecord with type = "PAYOUT" or Transaction with type = "WITHDRAWAL"
  const where = {
    type: "PAYOUT",
  };

  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { txRef: { contains: search, mode: "insensitive" } },
      { flwRef: { contains: search, mode: "insensitive" } },
      { user: { displayName: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (status && status !== "All") {
    where.status = status.toUpperCase();
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

  const allowedSortFields = ["createdAt", "amount", "status"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";
  const orderBy = { [sortField]: direction };

  const [
    total,
    withdrawals,
    statsTotal,
    statsPending,
    statsProcessing,
    statsCompleted,
    statsFailed,
  ] = await Promise.all([
    prisma.paymentRecord.count({ where }),
    prisma.paymentRecord.findMany({
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
            bankAccounts: {
              where: { isDeleted: false },
              select: {
                bankCode: true,
                bankName: true,
                accountNumber: true,
                accountName: true,
              },
            },
          },
        },
      },
    }),
    prisma.paymentRecord.count({ where: { type: "PAYOUT" } }),
    prisma.paymentRecord.count({ where: { type: "PAYOUT", status: "PENDING" } }),
    prisma.paymentRecord.count({ where: { type: "PAYOUT", status: "PROCESSING" } }),
    prisma.paymentRecord.count({ where: { type: "PAYOUT", status: "COMPLETED" } }),
    prisma.paymentRecord.count({ where: { type: "PAYOUT", status: "FAILED" } }),
  ]);

  return {
    withdrawals,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats: {
      totalWithdrawals: statsTotal,
      pending: statsPending,
      processing: statsProcessing,
      completed: statsCompleted,
      failed: statsFailed,
    },
  };
};

/**
 * Retrieve single withdrawal request detail
 */
const getWithdrawalById = async (id) => {
  const withdrawal = await prisma.paymentRecord.findFirst({
    where: {
      id,
      type: "PAYOUT",
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          bankAccounts: {
            where: { isDeleted: false },
          },
        },
      },
    },
  });

  if (!withdrawal) {
    throw new Error("Withdrawal request not found");
  }

  return withdrawal;
};

/**
 * Retrieve subscription payment records (invoices, upgrades, renewals, cancellations)
 */
const getSubscriptionPayments = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    tier,
    billingCycle,
    dateStart,
    dateEnd,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};

  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      { user: { displayName: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (status && status !== "All") {
    where.status = status.toUpperCase();
  }

  if (tier && tier !== "All") {
    where.tier = tier.toUpperCase();
  }

  if (billingCycle && billingCycle !== "All") {
    where.billingCycle = billingCycle.toUpperCase();
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

  const allowedSortFields = ["createdAt", "amount", "status", "periodStart", "paidAt"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";
  const orderBy = { [sortField]: direction };

  const [
    total,
    invoices,
    statsTotal,
    statsPaid,
    statsPending,
    statsFailed,
  ] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
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
            tier: true,
            subscription: {
              select: {
                status: true,
                billingCycle: true,
                canceledAt: true,
                cancelAtPeriodEnd: true,
              },
            },
          },
        },
      },
    }),
    prisma.invoice.count(),
    prisma.invoice.count({ where: { status: "PAID" } }),
    prisma.invoice.count({ where: { status: "PENDING" } }),
    prisma.invoice.count({ where: { status: "FAILED" } }),
  ]);

  return {
    invoices,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats: {
      totalInvoices: statsTotal,
      paid: statsPaid,
      pending: statsPending,
      failed: statsFailed,
    },
  };
};

/**
 * Retrieve single subscription payment invoice details
 */
const getSubscriptionPaymentById = async (id) => {
  const invoice = await prisma.invoice.findUnique({
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
          subscription: true,
          savedPaymentMethods: {
            where: { isDeleted: false },
            select: {
              id: true,
              type: true,
              brand: true,
              last4: true,
              isDefault: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    throw new Error("Subscription payment record not found");
  }

  return invoice;
};

module.exports = {
  getWithdrawals,
  getWithdrawalById,
  getSubscriptionPayments,
  getSubscriptionPaymentById,
};
