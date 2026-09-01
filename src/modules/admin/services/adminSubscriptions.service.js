const prisma = require("../../../config/prismaClient");

/**
 * Task 1: Retrieve subscription records with summary counts, search, filtering, sorting, and pagination.
 * FR: FRA83, FRA84, FRA85 | NFR: NFRA52, NFRA57
 */
const getSubscriptions = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    tier,
    status,
    paymentStatus,
    renewalDateFrom,
    renewalDateTo,
    dateCreatedFrom,
    dateCreatedTo,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

  const where = {};

  // FRA84: Support search using User name, User ID, Subscription ID, Payment reference
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { userId: { contains: search, mode: "insensitive" } },
      { user: { displayName: { contains: search, mode: "insensitive" } } },
      { user: { legalName: { contains: search, mode: "insensitive" } } },
      { user: { firstName: { contains: search, mode: "insensitive" } } },
      { user: { lastName: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      {
        invoices: {
          some: {
            OR: [
              { invoiceNumber: { contains: search, mode: "insensitive" } },
              { id: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      },
    ];

    const upperSearch = search.toUpperCase();
    if (["BASIC", "ADVANCE", "PRO", "ELITE"].includes(upperSearch)) {
      where.OR.push({ tier: upperSearch });
    }
    if (["ACTIVE", "CANCELLED", "EXPIRED", "PAST_DUE", "TRIALING"].includes(upperSearch)) {
      where.OR.push({ status: upperSearch });
    }
  }

  // FRA85: Support filtering by Subscription plan
  if (tier && tier !== "All") {
    where.tier = tier;
  }

  // FRA85: Support filtering by Subscription status
  if (status && status !== "All") {
    where.status = status;
  }

  // FRA85: Support filtering by Payment status (via linked invoices)
  if (paymentStatus && paymentStatus !== "All") {
    where.invoices = {
      some: {
        status: paymentStatus,
      },
    };
  }

  // FRA85: Support filtering by Renewal date (currentPeriodEnd)
  if (renewalDateFrom || renewalDateTo) {
    where.currentPeriodEnd = {};
    if (renewalDateFrom) where.currentPeriodEnd.gte = new Date(renewalDateFrom);
    if (renewalDateTo) where.currentPeriodEnd.lte = new Date(renewalDateTo);
  }

  // FRA85: Support filtering by Date created (createdAt)
  if (dateCreatedFrom || dateCreatedTo) {
    where.createdAt = {};
    if (dateCreatedFrom) where.createdAt.gte = new Date(dateCreatedFrom);
    if (dateCreatedTo) where.createdAt.lte = new Date(dateCreatedTo);
  }

  const allowedSorts = ["createdAt", "currentPeriodEnd", "tier", "status"];
  const sortField = allowedSorts.includes(sortBy) ? sortBy : "createdAt";

  const [total, subscriptions] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { [sortField]: direction },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            legalName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            accountStatus: true,
          },
        },
        invoices: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            currency: true,
            status: true,
            paidAt: true,
            pdfUrl: true,
            hostedInvoiceUrl: true,
          },
        },
      },
    }),
  ]);

  // Aggregate summary counts for overview
  const [totalSubscriptions, activeCount, trialingCount, pastDueCount, cancelledCount, expiredCount] =
    await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.count({ where: { status: "TRIALING" } }),
      prisma.subscription.count({ where: { status: "PAST_DUE" } }),
      prisma.subscription.count({ where: { status: "CANCELLED" } }),
      prisma.subscription.count({ where: { status: "EXPIRED" } }),
    ]);

  // Format subscription records according to Acceptance Criteria
  const formattedSubscriptions = subscriptions.map((sub) => {
    const latestInvoice = sub.invoices[0] || null;
    return {
      id: sub.id,
      userId: sub.userId,
      userName:
        sub.user.displayName ||
        `${sub.user.firstName || ""} ${sub.user.lastName || ""}`.trim() ||
        sub.user.email,
      userEmail: sub.user.email,
      avatarUrl: sub.user.avatarUrl,
      subscriptionPlan: sub.tier,
      subscriptionStatus: sub.status,
      billingCycle: sub.billingCycle,
      startDate: sub.currentPeriodStart,
      renewalDate: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      canceledAt: sub.canceledAt,
      paymentStatus: latestInvoice ? latestInvoice.status : "PAID",
      paymentReference: latestInvoice ? latestInvoice.invoiceNumber : null,
      latestInvoice: latestInvoice,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    };
  });

  return {
    summary: {
      totalSubscriptions,
      activeCount,
      trialingCount,
      pastDueCount,
      cancelledCount,
      expiredCount,
    },
    subscriptions: formattedSubscriptions,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Task 2: Retrieve full subscription details, billing history, payment activity, and failed payment/retry records.
 * FR: FRA86, FRA87, FRA88, FRA90 | NFR: NFRA53, NFRA54, NFRA55
 */
const getSubscriptionDetails = async (subscriptionId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          legalName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          phoneNumber: true,
          accountStatus: true,
          createdAt: true,
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      paymentRetries: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      issues: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  // Also fetch saved payment methods for the user
  const savedPaymentMethods = await prisma.savedPaymentMethod.findMany({
    where: { userId: subscription.userId, isDeleted: false },
    select: {
      id: true,
      type: true,
      provider: true,
      last4: true,
      brand: true,
      expMonth: true,
      expYear: true,
      isDefault: true,
    },
  });

  return {
    subscription: {
      id: subscription.id,
      userId: subscription.userId,
      user: subscription.user,
      currentSubscriptionPlan: subscription.tier,
      subscriptionStatus: subscription.status,
      billingCycle: subscription.billingCycle,
      subscriptionStartDate: subscription.currentPeriodStart,
      renewalDate: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt,
      createdAt: subscription.createdAt,
    },
    billingHistory: subscription.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      paymentDate: inv.paidAt || inv.createdAt,
      amountPaid: inv.amount,
      currency: inv.currency,
      tier: inv.tier,
      billingCycle: inv.billingCycle,
      paymentStatus: inv.status,
      hostedInvoiceUrl: inv.hostedInvoiceUrl,
      pdfUrl: inv.pdfUrl,
      createdAt: inv.createdAt,
    })),
    activityHistory: subscription.activities,
    paymentRetries: subscription.paymentRetries,
    issues: subscription.issues,
    savedPaymentMethods,
    isReadOnly: true,
  };
};

/**
 * Task 2: Retrieve user billing history with invoices and payment records.
 * FR: FRA88 | NFR: NFRA53, NFRA54, NFRA55
 */
const getUserBillingHistory = async (userId, query = {}) => {
  const { page = 1, limit = 10, status } = query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = { userId };
  if (status && status !== "All") {
    where.status = status;
  }

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: limitNum,
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
    billingHistory: invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      user: inv.user,
      paymentDate: inv.paidAt || inv.createdAt,
      amountPaid: inv.amount,
      currency: inv.currency,
      tier: inv.tier,
      billingCycle: inv.billingCycle,
      paymentStatus: inv.status,
      hostedInvoiceUrl: inv.hostedInvoiceUrl,
      pdfUrl: inv.pdfUrl,
      createdAt: inv.createdAt,
    })),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    isReadOnly: true,
  };
};

/**
 * Task 2: Retrieve premium subscription activity (upgrades, downgrades, cancellations, renewals).
 * FR: FRA87
 */
const getSubscriptionActivities = async (subscriptionId, query = {}) => {
  const { page = 1, limit = 10, type } = query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = { subscriptionId };
  if (type && type !== "All") {
    where.type = type;
  }

  const [total, activities] = await Promise.all([
    prisma.subscriptionActivity.count({ where }),
    prisma.subscriptionActivity.findMany({
      where,
      skip,
      take: limitNum,
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
    activities,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Task 2 & Task 3: Retrieve failed subscription payments and retry attempts across platform.
 * FR: FRA90 | NFR: NFRA53
 */
const getFailedSubscriptionPayments = async (query = {}) => {
  const { page = 1, limit = 10, search } = query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = {};
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { userId: { contains: search, mode: "insensitive" } },
      { failureReason: { contains: search, mode: "insensitive" } },
      { user: { displayName: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [totalRetries, retries, totalFailedInvoices, failedInvoices] = await Promise.all([
    prisma.subscriptionPaymentRetry.count({ where }),
    prisma.subscriptionPaymentRetry.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            status: true,
          },
        },
      },
    }),
    prisma.invoice.count({ where: { status: "FAILED" } }),
    prisma.invoice.findMany({
      where: { status: "FAILED" },
      take: 10,
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
    retries,
    totalRetries,
    failedInvoicesSummary: {
      count: totalFailedInvoices,
      recent: failedInvoices,
    },
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(totalRetries / limitNum),
  };
};

/**
 * Task 3: Retrieve subscription issues reported by users.
 * FR: FRA89, FRA90 | NFR: NFRA53, NFRA54, NFRA55
 */
const getSubscriptionIssues = async (filters = {}) => {
  const { page = 1, limit = 10, search, status, category } = filters;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { user: { displayName: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (status && status !== "All") {
    where.status = status;
  }

  if (category && category !== "All") {
    where.category = category;
  }

  const [total, issues] = await Promise.all([
    prisma.subscriptionIssue.count({ where }),
    prisma.subscriptionIssue.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        subscription: {
          select: {
            id: true,
            tier: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            status: true,
            paidAt: true,
          },
        },
      },
    }),
  ]);

  const [totalIssues, openCount, underReviewCount, resolvedCount, closedCount] =
    await Promise.all([
      prisma.subscriptionIssue.count(),
      prisma.subscriptionIssue.count({ where: { status: "OPEN" } }),
      prisma.subscriptionIssue.count({ where: { status: "UNDER_REVIEW" } }),
      prisma.subscriptionIssue.count({ where: { status: "RESOLVED" } }),
      prisma.subscriptionIssue.count({ where: { status: "CLOSED" } }),
    ]);

  return {
    summary: {
      totalIssues,
      openCount,
      underReviewCount,
      resolvedCount,
      closedCount,
    },
    issues,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Task 3: Retrieve single subscription issue details including notes, user info, subscription details, and payment history.
 * FR: FRA89
 */
const getSubscriptionIssueDetails = async (issueId) => {
  const issue = await prisma.subscriptionIssue.findUnique({
    where: { id: issueId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          legalName: true,
          avatarUrl: true,
          accountStatus: true,
          createdAt: true,
        },
      },
      subscription: {
        include: {
          activities: { take: 5, orderBy: { createdAt: "desc" } },
        },
      },
      invoice: true,
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

  if (!issue) {
    throw new Error("Subscription issue not found");
  }

  // Get recent payment history for user
  const paymentHistory = await prisma.invoice.findMany({
    where: { userId: issue.userId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    issue,
    paymentHistory,
  };
};

/**
 * Task 3: Create a subscription issue / complaint.
 */
const createSubscriptionIssue = async (payload) => {
  const { userId, subscriptionId, invoiceId, category, title, description } = payload;

  if (!userId || !title || !description) {
    throw new Error("userId, title, and description are required to report an issue");
  }

  const issue = await prisma.subscriptionIssue.create({
    data: {
      userId,
      subscriptionId,
      invoiceId,
      category: category || "BILLING_ERROR",
      title: title.trim(),
      description: description.trim(),
      status: "OPEN",
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  return issue;
};

/**
 * Task 3: Add internal admin note to a subscription issue.
 */
const addSubscriptionIssueNote = async (adminId, issueId, content) => {
  if (!content || !content.trim()) {
    throw new Error("Note content is required");
  }

  const issue = await prisma.subscriptionIssue.findUnique({
    where: { id: issueId },
  });

  if (!issue) {
    throw new Error("Subscription issue not found");
  }

  const note = await prisma.adminNote.create({
    data: {
      adminId,
      targetSubscriptionIssueId: issueId,
      targetUserId: issue.userId,
      content: content.trim(),
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

  return note;
};

/**
 * Task 3: Update subscription issue status (e.g., OPEN -> UNDER_REVIEW -> RESOLVED -> CLOSED).
 * Generates user notification and records in admin audit log.
 */
const updateSubscriptionIssueStatus = async (adminId, issueId, payload) => {
  const { status } = payload;

  if (!["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"].includes(status)) {
    throw new Error("Invalid status. Must be OPEN, UNDER_REVIEW, RESOLVED, or CLOSED");
  }

  const existingIssue = await prisma.subscriptionIssue.findUnique({
    where: { id: issueId },
  });

  if (!existingIssue) {
    throw new Error("Subscription issue not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedIssue = await tx.subscriptionIssue.update({
      where: { id: issueId },
      data: {
        status,
        resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : existingIssue.resolvedAt,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Notify user when issue status changes
    await tx.notification.create({
      data: {
        userId: existingIssue.userId,
        title: "Subscription Issue Status Updated",
        message: `Your subscription issue "${existingIssue.title}" status has been updated to ${status.replace("_", " ")}.`,
        type: "STATUS_UPDATE",
      },
    });

    // Log admin audit record
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: "SUBSCRIPTION_ISSUE_STATUS_UPDATED",
        targetUserId: existingIssue.userId,
        details: {
          issueId,
          previousStatus: existingIssue.status,
          newStatus: status,
          title: existingIssue.title,
        },
      },
    });

    return updatedIssue;
  });

  return result;
};

/**
 * Task 4: View all subscription plans with features and usage limits.
 * FR: FRA91 | NFR: NFRA53
 */
const getSubscriptionPlans = async () => {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { priceMonthly: "asc" },
  });

  return plans;
};

/**
 * Task 4: View a single subscription plan by ID or tier.
 */
const getSubscriptionPlanById = async (planIdOrTier) => {
  let plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planIdOrTier },
  });

  if (!plan && ["BASIC", "ADVANCE", "PRO", "ELITE"].includes(planIdOrTier.toUpperCase())) {
    plan = await prisma.subscriptionPlan.findUnique({
      where: { tier: planIdOrTier.toUpperCase() },
    });
  }

  if (!plan) {
    throw new Error("Subscription plan not found");
  }

  return plan;
};

/**
 * Task 4: Update subscription plan information (price, features, limits, status).
 * Validates administrative changes and records in audit log.
 * FR: FRA91 | NFR: NFRA53, NFRA56
 */
const updateSubscriptionPlan = async (adminId, planIdOrTier, payload) => {
  const existingPlan = await getSubscriptionPlanById(planIdOrTier);

  const { name, description, priceMonthly, priceAnnual, features, limits, isActive } = payload;

  const updatedPlan = await prisma.$transaction(async (tx) => {
    const plan = await tx.subscriptionPlan.update({
      where: { id: existingPlan.id },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        description: description !== undefined ? description : undefined,
        priceMonthly: priceMonthly !== undefined ? parseInt(priceMonthly) : undefined,
        priceAnnual: priceAnnual !== undefined ? parseInt(priceAnnual) : undefined,
        features: Array.isArray(features) ? features : undefined,
        limits: limits !== undefined ? limits : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });

    // NFRA56: Audit log recording plan change
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: "SUBSCRIPTION_PLAN_UPDATED",
        details: {
          planId: plan.id,
          tier: plan.tier,
          previous: {
            name: existingPlan.name,
            priceMonthly: existingPlan.priceMonthly,
            priceAnnual: existingPlan.priceAnnual,
            features: existingPlan.features,
            limits: existingPlan.limits,
            isActive: existingPlan.isActive,
          },
          updated: {
            name: plan.name,
            priceMonthly: plan.priceMonthly,
            priceAnnual: plan.priceAnnual,
            features: plan.features,
            limits: plan.limits,
            isActive: plan.isActive,
          },
        },
      },
    });

    return plan;
  });

  return updatedPlan;
};

/**
 * Task 5: Generate subscription and billing reports.
 * FR: FRA92 | NFR: NFRA56, NFRA57
 */
const getSubscriptionReports = async (filters = {}) => {
  const { dateFrom, dateTo, tier } = filters;

  const subWhere = {};
  const invWhere = { status: "PAID" };

  if (tier && tier !== "All") {
    subWhere.tier = tier;
    invWhere.tier = tier;
  }

  if (dateFrom || dateTo) {
    subWhere.createdAt = {};
    invWhere.createdAt = {};
    if (dateFrom) {
      subWhere.createdAt.gte = new Date(dateFrom);
      invWhere.createdAt.gte = new Date(dateFrom);
    }
    if (dateTo) {
      subWhere.createdAt.lte = new Date(dateTo);
      invWhere.createdAt.lte = new Date(dateTo);
    }
  }

  const [
    totalActiveSubscriptions,
    totalCancelledSubscriptions,
    totalPastDueSubscriptions,
    basicUsage,
    advanceUsage,
    proUsage,
    eliteUsage,
    paidInvoices,
    failedInvoices,
  ] = await Promise.all([
    prisma.subscription.count({ where: { ...subWhere, status: "ACTIVE" } }),
    prisma.subscription.count({ where: { ...subWhere, status: "CANCELLED" } }),
    prisma.subscription.count({ where: { ...subWhere, status: "PAST_DUE" } }),
    prisma.subscription.count({ where: { ...subWhere, tier: "BASIC" } }),
    prisma.subscription.count({ where: { ...subWhere, tier: "ADVANCE" } }),
    prisma.subscription.count({ where: { ...subWhere, tier: "PRO" } }),
    prisma.subscription.count({ where: { ...subWhere, tier: "ELITE" } }),
    prisma.invoice.findMany({ where: invWhere, select: { amount: true, tier: true, billingCycle: true } }),
    prisma.invoice.findMany({ where: { status: "FAILED" }, select: { amount: true } }),
  ]);

  const totalRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const totalFailedAmount = failedInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

  return {
    metrics: {
      activeSubscriptionsCount: totalActiveSubscriptions,
      cancelledSubscriptionsCount: totalCancelledSubscriptions,
      pastDueSubscriptionsCount: totalPastDueSubscriptions,
      planUsage: {
        BASIC: basicUsage,
        ADVANCE: advanceUsage,
        PRO: proUsage,
        ELITE: eliteUsage,
      },
      revenueRecords: {
        totalRevenue,
        currency: "NGN",
        paidInvoicesCount: paidInvoices.length,
      },
      failedPayments: {
        count: failedInvoices.length,
        totalFailedAmount,
      },
    },
    generatedAt: new Date(),
  };
};

/**
 * Task 5: Retrieve read-only audit log records for subscription and billing administrative actions.
 * FR: FRA93 | NFR: NFRA56
 */
const getSubscriptionAuditHistory = async (query = {}) => {
  const { page = 1, limit = 10, search } = query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = {
    action: { startsWith: "SUBSCRIPTION_" },
  };

  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { admin: { email: { contains: search, mode: "insensitive" } } },
      { targetUser: { displayName: { contains: search, mode: "insensitive" } } },
      { targetUser: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [total, auditLogs] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      skip,
      take: limitNum,
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
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      actionPerformed: log.action,
      administratorResponsible: {
        id: log.admin.id,
        email: log.admin.email,
        role: log.admin.role,
      },
      targetUser: log.targetUser,
      dateTime: log.createdAt,
      details: log.details,
    })),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    isReadOnly: true,
  };
};

module.exports = {
  getSubscriptions,
  getSubscriptionDetails,
  getUserBillingHistory,
  getSubscriptionActivities,
  getFailedSubscriptionPayments,
  getSubscriptionIssues,
  getSubscriptionIssueDetails,
  createSubscriptionIssue,
  addSubscriptionIssueNote,
  updateSubscriptionIssueStatus,
  getSubscriptionPlans,
  getSubscriptionPlanById,
  updateSubscriptionPlan,
  getSubscriptionReports,
  getSubscriptionAuditHistory,
};
