const prisma = require("../../../config/prismaClient");
const { createNotification } = require("../../notifications/services/notification.service");
const { SUPPORT_AUDIT_ACTIONS } = require("../../../config/constants");
const { buildRawWhereClause } = require("../../../helpers/rawQueryHelpers");


const logSupportAudit = async (ticketId, adminId, action, details = {}, tx = prisma) => {
  return tx.supportTicketAuditLog.create({
    data: {
      ticketId,
      adminId,
      action,
      previousStatus: details.previousStatus ?? null,
      newStatus: details.newStatus ?? null,
      details,
    },
  });
};

/**
 * Retrieve all support requests with search, filtering, sorting, pagination, and summary counts.
 * FR: FRA94, FRA95, FRA96
 */
const getSupportTickets = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    category,
    assignedAdminId,
    dateFrom,
    dateTo,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

  const where = {};

  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { subject: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { displayName: { contains: search, mode: "insensitive" } } },
      { user: { firstName: { contains: search, mode: "insensitive" } } },
      { user: { lastName: { contains: search, mode: "insensitive" } } },
      { user: { legalName: { contains: search, mode: "insensitive" } } },
    ];

    const upperSearch = search.toUpperCase();
    const validCategories = [
      "ACCOUNT",
      "BILLING",
      "TECHNICAL",
      "PROJECT",
      "COLLABORATION",
      "VERIFICATION",
      "DISPUTE",
      "OTHER",
    ];
    if (validCategories.includes(upperSearch)) {
      where.OR.push({ category: upperSearch });
    }
  }

  if (status && status !== "All") {
    where.status = status;
  }
  if (category && category !== "All") {
    where.category = category;
  }

  if (assignedAdminId && assignedAdminId !== "All") {
    if (assignedAdminId === "unassigned") {
      where.assignedAdminId = null;
    } else {
      where.assignedAdminId = assignedAdminId;
    }
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const allowedSortFields = ["createdAt", "updatedAt", "status", "category", "subject"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";

  const [total, tickets] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
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
            firstName: true,
            lastName: true,
            legalName: true,
            avatarUrl: true,
            accountStatus: true,
          },
        },
        assignedAdmin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  const [
    totalCount,
    openCount,
    inProgressCount,
    resolvedCount,
    closedCount,
    unassignedCount,
  ] = await Promise.all([
    prisma.supportTicket.count(),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.supportTicket.count({ where: { status: "RESOLVED" } }),
    prisma.supportTicket.count({ where: { status: "CLOSED" } }),
    prisma.supportTicket.count({ where: { assignedAdminId: null } }),
  ]);

  return {
    summary: {
      totalCount,
      openCount,
      inProgressCount,
      resolvedCount,
      closedCount,
      unassignedCount,
    },
    tickets,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};


const getSupportTicketById = async (ticketId) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          legalName: true,
          avatarUrl: true,
          phoneNumber: true,
          accountStatus: true,
          tier: true,
          createdAt: true,
        },
      },
      assignedAdmin: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      resolvedByAdmin: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          admin: { select: { id: true, email: true, role: true } },
        },
      },
      auditLogs: {
        orderBy: { createdAt: "asc" },
        include: {
          admin: { select: { id: true, email: true, role: true } },
        },
      },
    },
  });

  if (!ticket) {
    throw new Error("Support ticket not found");
  }

  return ticket;
};


const getSupportTicketsSummary = async () => {
  const [
    totalCount,
    openCount,
    inProgressCount,
    resolvedCount,
    closedCount,
    unassignedCount,
    categoryCounts,
  ] = await Promise.all([
    prisma.supportTicket.count(),
    prisma.supportTicket.count({ where: { status: "OPEN" } }),
    prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.supportTicket.count({ where: { status: "RESOLVED" } }),
    prisma.supportTicket.count({ where: { status: "CLOSED" } }),
    prisma.supportTicket.count({ where: { assignedAdminId: null } }),
    prisma.supportTicket.groupBy({
      by: ["category"],
      _count: { id: true },
    }),
  ]);

  const byCategory = categoryCounts.reduce((acc, entry) => {
    acc[entry.category] = entry._count.id;
    return acc;
  }, {});

  return {
    totalCount,
    openCount,
    inProgressCount,
    resolvedCount,
    closedCount,
    unassignedCount,
    byCategory,
  };
};

/**
 * Send an admin response or internal note on a support ticket.
 * - isInternal: true  → internal note, never shown to user, no notification sent
 * - isInternal: false → user-facing reply, fires a SUPPORT_TICKET_REPLY notification
 * Also writes an audit log entry for every message.
 */
const sendMessage = async (ticketId, adminId, { message, isInternal = false }) => {
  if (!message || !message.trim()) {
    throw new Error("Message content is required");
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
    },
  });

  if (!ticket) {
    throw new Error("Support ticket not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the message record with admin attribution
    const newMessage = await tx.supportTicketMessage.create({
      data: {
        ticketId,
        adminId,
        message: message.trim(),
        isInternal,
      },
      include: {
        admin: { select: { id: true, email: true, role: true } },
      },
    });

    if (!ticket.firstResponseAt && !isInternal) {
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { firstResponseAt: new Date() },
      });
    }
    
    if (ticket.status === "OPEN" && !isInternal) {
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { status: "IN_PROGRESS" },
      });
      await logSupportAudit(
        ticketId,
        adminId,
        SUPPORT_AUDIT_ACTIONS.STATUS_CHANGED,
        { previousStatus: "OPEN", newStatus: "IN_PROGRESS", triggeredBy: "first_reply" },
        tx
      );
    }

    // 4. Write audit record for this message action
    await logSupportAudit(
      ticketId,
      adminId,
      isInternal
        ? SUPPORT_AUDIT_ACTIONS.INTERNAL_NOTE_ADDED
        : SUPPORT_AUDIT_ACTIONS.REPLY_SENT,
      { messageId: newMessage.id, isInternal },
      tx
    );

    // 5. Notify the user — only for user-facing replies, not internal notes
    if (!isInternal) {
      await createNotification({
        userId: ticket.userId,
        title: "Support ticket update",
        message: `An administrator has responded to your support request: "${ticket.subject}"`,
        type: "SUPPORT_TICKET_REPLY",
        link: `/support/tickets/${ticketId}`,
      });
    }

    return newMessage;
  });

  return result;
};

/**
 * Retrieve the full conversation history for a support ticket.
 * Internal notes are included for admins only — caller is responsible
 * for passing includeInternal = true only for authenticated admin requests.
 */
const getConversationHistory = async (ticketId, { includeInternal = true } = {}) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      assignedAdmin: { select: { id: true, email: true, role: true } },
    },
  });

  if (!ticket) {
    throw new Error("Support ticket not found");
  }

  const where = { ticketId };
  if (!includeInternal) {
    where.isInternal = false;
  }

  const messages = await prisma.supportTicketMessage.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      admin: { select: { id: true, email: true, role: true } },
    },
  });

  return {
    ticket,
    messages,
    totalMessages: messages.length,
    internalNotes: messages.filter((m) => m.isInternal).length,
    responses: messages.filter((m) => !m.isInternal).length,
  };
};

const getSupportHistory = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    category,
    dateFrom,
    dateTo,
    sortBy = "resolvedAt",
    sortOrder = "desc",
  } = filters;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;
  const direction = sortOrder === "asc" ? "asc" : "desc";

  const where = {
    status: { in: ["RESOLVED", "CLOSED"] },
  };

  if (category && category !== "All") {
    where.category = category;
  }

  if (dateFrom || dateTo) {
    where.resolvedAt = {};
    if (dateFrom) where.resolvedAt.gte = new Date(dateFrom);
    if (dateTo) where.resolvedAt.lte = new Date(dateTo);
  }

  const allowedSortFields = ["resolvedAt", "createdAt", "category"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "resolvedAt";

  const [total, tickets] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { [sortField]: direction },
      select: {
        id: true,
        subject: true,
        category: true,
        status: true,
        resolution: true,
        resolvedAt: true,
        firstResponseAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        resolvedByAdmin: {
          select: { id: true, email: true, role: true },
        },
        assignedAdmin: {
          select: { id: true, email: true, role: true },
        },
      },
    }),
  ]);

  return {
    tickets,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};


const getResolutionRecord = async (ticketId) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          legalName: true,
          avatarUrl: true,
          phoneNumber: true,
          accountStatus: true,
        },
      },
      assignedAdmin: { select: { id: true, email: true, role: true } },
      resolvedByAdmin: { select: { id: true, email: true, role: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          admin: { select: { id: true, email: true, role: true } },
        },
      },
      auditLogs: {
        orderBy: { createdAt: "asc" },
        include: {
          admin: { select: { id: true, email: true, role: true } },
        },
      },
    },
  });

  if (!ticket) {
    throw new Error("Support ticket not found");
  }

  const responseTimeMinutes =
    ticket.firstResponseAt && ticket.createdAt
      ? Math.round((ticket.firstResponseAt - ticket.createdAt) / 60000)
      : null;

  const resolutionTimeMinutes =
    ticket.resolvedAt && ticket.createdAt
      ? Math.round((ticket.resolvedAt - ticket.createdAt) / 60000)
      : null;

  return {
    ticket,
    metrics: {
      responseTimeMinutes,
      resolutionTimeMinutes,
    },
  };
};


// Groups tickets by category, status, or date with optional filters.
const generateReport = async (filters = {}) => {
  const {
    groupBy = "category",
    dateFrom,
    dateTo,
    category,
    status,
    granularity = "monthly",
  } = filters;

  const where = {};
  if (category && category !== "All") where.category = category;
  if (status && status !== "All") where.status = status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  let report = {};

  if (groupBy === "category") {
    const rows = await prisma.supportTicket.groupBy({
      by: ["category"],
      where,
      _count: { id: true },
    });
    report.byCategory = rows.map((r) => ({
      category: r.category,
      count: r._count.id,
    }));

    // Also break down resolved count per category
    const resolvedRows = await prisma.supportTicket.groupBy({
      by: ["category"],
      where: { ...where, status: { in: ["RESOLVED", "CLOSED"] } },
      _count: { id: true },
    });
    const resolvedMap = resolvedRows.reduce((acc, r) => {
      acc[r.category] = r._count.id;
      return acc;
    }, {});

    report.byCategory = report.byCategory.map((row) => ({
      ...row,
      resolved: resolvedMap[row.category] ?? 0,
      unresolved: row.count - (resolvedMap[row.category] ?? 0),
    }));
  } else if (groupBy === "status") {
    const rows = await prisma.supportTicket.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
    });
    report.byStatus = rows.map((r) => ({
      status: r.status,
      count: r._count.id,
    }));
  } else if (groupBy === "date") {
    // Raw aggregation by date using Prisma raw query for date truncation
    const truncFn =
      granularity === "daily"
        ? "day"
        : granularity === "weekly"
        ? "week"
        : "month";

    const rawRows = await prisma.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('${truncFn}', "createdAt") AS period,
        COUNT(*)::int                          AS total,
        SUM(CASE WHEN status IN ('RESOLVED','CLOSED') THEN 1 ELSE 0 END)::int AS resolved
      FROM "SupportTicket"
      ${
        Object.keys(where).length
          ? `WHERE ${buildRawWhereClause(where)}`
          : ""
      }
      GROUP BY 1
      ORDER BY 1 DESC
    `);

    report.byDate = rawRows.map((r) => ({
      period: r.period,
      total: r.total,
      resolved: r.resolved,
      unresolved: r.total - r.resolved,
    }));
  }

  // Summary totals always included
  const [totalCount, resolvedCount, openCount, inProgressCount, closedCount] =
    await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.count({ where: { ...where, status: { in: ["RESOLVED", "CLOSED"] } } }),
      prisma.supportTicket.count({ where: { ...where, status: "OPEN" } }),
      prisma.supportTicket.count({ where: { ...where, status: "IN_PROGRESS" } }),
      prisma.supportTicket.count({ where: { ...where, status: "CLOSED" } }),
    ]);

  return {
    filters: { groupBy, dateFrom, dateTo, category, status, granularity },
    summary: {
      totalCount,
      resolvedCount,
      openCount,
      inProgressCount,
      closedCount,
      resolutionRate:
        totalCount > 0 ? ((resolvedCount / totalCount) * 100).toFixed(2) + "%" : "0%",
    },
    report,
    generatedAt: new Date().toISOString(),
  };
};


const getResponseResolutionMetrics = async (filters = {}) => {
  const { period = "monthly", dateFrom, dateTo, category } = filters;

  const where = {
    status: { in: ["RESOLVED", "CLOSED"] },
    resolvedAt: { not: null },
    firstResponseAt: { not: null },
  };
  if (category && category !== "All") where.category = category;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const tickets = await prisma.supportTicket.findMany({
    where,
    select: {
      id: true,
      category: true,
      createdAt: true,
      firstResponseAt: true,
      resolvedAt: true,
    },
  });

  if (!tickets.length) {
    return {
      filters,
      totalResolved: 0,
      avgResponseTimeMinutes: null,
      avgResolutionTimeMinutes: null,
      medianResponseTimeMinutes: null,
      medianResolutionTimeMinutes: null,
      slaCompliance: null,
      byCategory: [],
    };
  }

  const responseTimes = tickets
    .filter((t) => t.firstResponseAt)
    .map((t) => (t.firstResponseAt - t.createdAt) / 60000);

  const resolutionTimes = tickets
    .filter((t) => t.resolvedAt)
    .map((t) => (t.resolvedAt - t.createdAt) / 60000);

  const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  const median = (arr) => {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  // SLA target: first response within 4 hours (240 min)
  const SLA_RESPONSE_MINUTES = 240;
  const withinSLA = responseTimes.filter((t) => t <= SLA_RESPONSE_MINUTES).length;
  const slaCompliance =
    responseTimes.length > 0
      ? ((withinSLA / responseTimes.length) * 100).toFixed(2) + "%"
      : null;

  // Per-category breakdown
  const categoryMap = {};
  for (const t of tickets) {
    if (!categoryMap[t.category]) {
      categoryMap[t.category] = { responseTimes: [], resolutionTimes: [] };
    }
    if (t.firstResponseAt) {
      categoryMap[t.category].responseTimes.push((t.firstResponseAt - t.createdAt) / 60000);
    }
    if (t.resolvedAt) {
      categoryMap[t.category].resolutionTimes.push((t.resolvedAt - t.createdAt) / 60000);
    }
  }

  const byCategory = Object.entries(categoryMap).map(([cat, data]) => ({
    category: cat,
    count: data.resolutionTimes.length,
    avgResponseTimeMinutes: avg(data.responseTimes)?.toFixed(2) ?? null,
    avgResolutionTimeMinutes: avg(data.resolutionTimes)?.toFixed(2) ?? null,
  }));

  return {
    filters,
    totalResolved: tickets.length,
    avgResponseTimeMinutes: avg(responseTimes)?.toFixed(2) ?? null,
    avgResolutionTimeMinutes: avg(resolutionTimes)?.toFixed(2) ?? null,
    medianResponseTimeMinutes: median(responseTimes)?.toFixed(2) ?? null,
    medianResolutionTimeMinutes: median(resolutionTimes)?.toFixed(2) ?? null,
    slaComplianceRate: slaCompliance,
    slaTargetMinutes: SLA_RESPONSE_MINUTES,
    byCategory,
    generatedAt: new Date().toISOString(),
  };
};

const getSupportAuditHistory = async (filters = {}) => {
  const {
    page = 1,
    limit = 20,
    ticketId,
    adminId,
    action,
    dateFrom,
    dateTo,
    sortOrder = "desc",
  } = filters;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const skip = (pageNum - 1) * limitNum;
  const direction = sortOrder === "asc" ? "asc" : "desc";

  const where = {};
  if (ticketId) where.ticketId = ticketId;
  if (adminId) where.adminId = adminId;
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const [total, logs] = await Promise.all([
    prisma.supportTicketAuditLog.count({ where }),
    prisma.supportTicketAuditLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: direction },
      include: {
        admin: { select: { id: true, email: true, role: true } },
        ticket: {
          select: {
            id: true,
            subject: true,
            category: true,
            status: true,
          },
        },
      },
    }),
  ]);

  return {
    logs,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

const assignTicket = async (ticketId, actingAdminId, { assignedAdminId }) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
      assignedAdmin: { select: { id: true, email: true } },
    },
  });

  if (!ticket) {
    throw new Error("Support ticket not found");
  }

  const previousAdminId = ticket.assignedAdminId;
  const isUnassigning = assignedAdminId === null;

  // Determine audit action
  let auditAction;
  if (isUnassigning) {
    auditAction = SUPPORT_AUDIT_ACTIONS.UNASSIGNED;
  } else if (previousAdminId && previousAdminId !== assignedAdminId) {
    auditAction = SUPPORT_AUDIT_ACTIONS.REASSIGNED;
  } else {
    auditAction = SUPPORT_AUDIT_ACTIONS.ASSIGNED;
  }

  // Validate the target admin exists (skip if unassigning)
  let targetAdmin = null;
  if (!isUnassigning) {
    targetAdmin = await prisma.adminUser.findUnique({
      where: { id: assignedAdminId },
      select: { id: true, email: true, role: true },
    });
    if (!targetAdmin) {
      throw new Error("Target admin not found");
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const updateData = { assignedAdminId };
    if (!ticket.firstResponseAt && !isUnassigning) {
      updateData.firstResponseAt = new Date();
    }

    const updated = await tx.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        assignedAdmin: { select: { id: true, email: true, role: true } },
      },
    });

    await logSupportAudit(
      ticketId,
      actingAdminId,
      auditAction,
      {
        previousAssignedAdminId: previousAdminId ?? null,
        newAssignedAdminId: assignedAdminId,
        previousAssigneeEmail: ticket.assignedAdmin?.email ?? null,
        newAssigneeEmail: targetAdmin?.email ?? null,
        assignedAt: new Date().toISOString(),
      },
      tx
    );

    if (!isUnassigning) {
      await createNotification({
        userId: ticket.userId,
        title: "Support request assigned",
        message: `Your support request "${ticket.subject}" has been assigned to an administrator and is being handled.`,
        type: "SUPPORT_TICKET_ASSIGNED",
        link: `/support/tickets/${ticketId}`,
      });
    }

    return updated;
  });

  return result;
};


/**
 * User-facing status notification messages keyed by new status.
 */
const STATUS_NOTIFICATION_MESSAGES = {
  OPEN: (subject) =>
    `Your support request "${subject}" has been reopened and is awaiting review.`,
  IN_PROGRESS: (subject) =>
    `An administrator is now actively working on your support request "${subject}".`,
  RESOLVED: (subject) =>
    `Your support request "${subject}" has been resolved. Please check the resolution details.`,
  CLOSED: (subject) =>
    `Your support request "${subject}" has been closed. Thank you for contacting support.`,
};

const updateTicketStatus = async (ticketId, actingAdminId, { status, resolution }) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, email: true, displayName: true } },
    },
  });

  if (!ticket) {
    throw new Error("Support ticket not found");
  }

  const previousStatus = ticket.status;

  if (previousStatus === status) {
    throw new Error(`Ticket is already in ${status} status`);
  }

  // Enforce valid transitions
  const ALLOWED_TRANSITIONS = {
    OPEN: ["IN_PROGRESS", "CLOSED"],
    IN_PROGRESS: ["OPEN", "RESOLVED", "CLOSED"],
    RESOLVED: ["CLOSED"],
    CLOSED: [],
  };

  const allowed = ALLOWED_TRANSITIONS[previousStatus] ?? [];
  if (!allowed.includes(status)) {
    throw new Error(
      `Invalid status transition from ${previousStatus} to ${status}. Allowed: ${allowed.join(", ") || "none"}`
    );
  }

  const now = new Date();
  const updateData = { status };

  if (status === "RESOLVED") {
    if (!resolution || !resolution.trim()) {
      throw new Error("A resolution summary is required when marking a ticket as RESOLVED");
    }
    updateData.resolution = resolution.trim();
    updateData.resolvedAt = now;
    updateData.resolvedByAdminId = actingAdminId;
  }

  if (status === "CLOSED") {
    if (!ticket.resolvedAt) {
      updateData.resolvedAt = now;
    }
  }
  if (!ticket.firstResponseAt) {
    updateData.firstResponseAt = now;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.supportTicket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        assignedAdmin: { select: { id: true, email: true, role: true } },
        resolvedByAdmin: { select: { id: true, email: true, role: true } },
      },
    });

    await logSupportAudit(
      ticketId,
      actingAdminId,
      SUPPORT_AUDIT_ACTIONS.STATUS_CHANGED,
      {
        previousStatus,
        newStatus: status,
        resolution: resolution ?? null,
        resolvedAt: updateData.resolvedAt?.toISOString() ?? null,
        changedAt: now.toISOString(),
      },
      tx
    );

    const notifyMsg = STATUS_NOTIFICATION_MESSAGES[status];
    await createNotification({
      userId: ticket.userId,
      title: `Support request ${status.toLowerCase().replace("_", " ")}`,
      message: notifyMsg(ticket.subject),
      type: "SUPPORT_TICKET_STATUS_UPDATED",
      link: `/support/tickets/${ticketId}`,
    });

    return updated;
  });

  return result;
};


const updateTicketCategory = async (ticketId, actingAdminId, { category }) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, category: true, subject: true },
  });

  if (!ticket) {
    throw new Error("Support ticket not found");
  }

  const previousCategory = ticket.category;

  if (previousCategory === category) {
    throw new Error(`Ticket category is already set to ${category}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.supportTicket.update({
      where: { id: ticketId },
      data: { category },
      select: {
        id: true,
        subject: true,
        category: true,
        status: true,
        updatedAt: true,
        assignedAdmin: { select: { id: true, email: true, role: true } },
      },
    });

    await logSupportAudit(
      ticketId,
      actingAdminId,
      SUPPORT_AUDIT_ACTIONS.CATEGORY_CHANGED,
      {
        previousCategory,
        newCategory: category,
        changedAt: new Date().toISOString(),
      },
      tx
    );

    return updated;
  });

  return result;
};

module.exports = {
  getSupportTickets,
  getSupportTicketById,
  getSupportTicketsSummary,
  sendMessage,
  getConversationHistory,
  getSupportHistory,
  getResolutionRecord,
  getResponseResolutionMetrics,
  generateReport,
  getSupportAuditHistory,
  logSupportAudit,
  assignTicket,
  updateTicketStatus,
  updateTicketCategory,
};

