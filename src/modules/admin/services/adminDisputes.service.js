const prisma = require("../../../config/prismaClient");
const { createNotification } = require("../../notifications/services/notification.service");

/**
 * Retrieve disputes with pagination, search, filtering, and stats summary
 */
const getDisputes = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    category,
    dateStart,
    dateEnd,
    assignedAdminId,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const skip = (page - 1) * limit;
  const where = {};

  // Filter by status
  if (status && status !== "All") {
    where.status = status.toUpperCase();
  }

  // Filter by category
  if (category && category !== "All") {
    where.category = category.toUpperCase();
  }

  // Filter by assigned admin
  if (assignedAdminId) {
    if (assignedAdminId === "unassigned") {
      where.assignedAdminId = null;
    } else {
      where.assignedAdminId = assignedAdminId;
    }
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

  // Search across dispute ID, transaction ID, reason, description, reporter name/email, reported user name/email, project name
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { transactionId: { contains: search, mode: "insensitive" } },
      { reason: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { reporter: { displayName: { contains: search, mode: "insensitive" } } },
      { reporter: { email: { contains: search, mode: "insensitive" } } },
      { reporter: { firstName: { contains: search, mode: "insensitive" } } },
      { reporter: { lastName: { contains: search, mode: "insensitive" } } },
      { reportedUser: { displayName: { contains: search, mode: "insensitive" } } },
      { reportedUser: { email: { contains: search, mode: "insensitive" } } },
      { reportedUser: { firstName: { contains: search, mode: "insensitive" } } },
      { reportedUser: { lastName: { contains: search, mode: "insensitive" } } },
      { project: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Sorting setup
  const allowedSortFields = ["createdAt", "status", "reason", "category"];
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
    catPayment,
    catEscrow,
    catAgreement,
    catCollaboration,
    catConduct,
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
        assignedAdmin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        decision: {
          select: {
            id: true,
            resolutionSummary: true,
            outcome: true,
            resolvedAt: true,
          },
        },
        _count: {
          select: {
            adminNotes: true,
            messages: true,
            evidenceRequests: true,
            auditLogs: true,
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
    prisma.dispute.count({ where: { category: "PAYMENT" } }),
    prisma.dispute.count({ where: { category: "ESCROW_MILESTONE" } }),
    prisma.dispute.count({ where: { category: "AGREEMENT_RELATED" } }),
    prisma.dispute.count({ where: { category: "PROJECT_COLLABORATION" } }),
    prisma.dispute.count({ where: { category: "USER_CONDUCT" } }),
  ]);

  return {
    disputes,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats: {
      totalDisputes: statsTotal,
      byStatus: {
        open: statsOpen,
        underReview: statsUnderReview,
        awaitingResponse: statsAwaitingResponse,
        resolved: statsResolved,
        closed: statsClosed,
      },
      byCategory: {
        payment: catPayment,
        escrowMilestone: catEscrow,
        agreementRelated: catAgreement,
        projectCollaboration: catCollaboration,
        userConduct: catConduct,
      },
    },
  };
};

/**
 * Retrieve comprehensive details for a dispute
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
          identityVerified: true,
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
          identityVerified: true,
        },
      },
      assignedAdmin: {
        select: {
          id: true,
          email: true,
          role: true,
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
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          senderAdmin: {
            select: { id: true, email: true, role: true },
          },
          senderUser: {
            select: { id: true, displayName: true, email: true, avatarUrl: true },
          },
        },
      },
      evidenceRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          admin: { select: { id: true, email: true, role: true } },
          targetUser: { select: { id: true, displayName: true, email: true } },
        },
      },
      decision: {
        include: {
          admin: { select: { id: true, email: true, role: true } },
        },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          admin: { select: { id: true, email: true, role: true } },
          user: { select: { id: true, displayName: true, email: true } },
        },
      },
    },
  });

  if (!dispute) {
    throw new Error("Dispute not found");
  }

  // Fetch payment records related to reporter, reported user, transactionId, or project
  const userIds = [dispute.reporterId, dispute.reportedUserId].filter(Boolean);
  const paymentWhere = {
    OR: [
      { userId: { in: userIds } },
      ...(dispute.transactionId
        ? [{ txRef: dispute.transactionId }, { flwRef: dispute.transactionId }]
        : []),
    ],
  };

  const paymentRecords = await prisma.paymentRecord.findMany({
    where: paymentWhere,
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
 * Assign or reassign a dispute to an administrator
 */
const assignDispute = async (adminId, disputeId, targetAdminId) => {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  if (targetAdminId) {
    const targetAdmin = await prisma.adminUser.findUnique({ where: { id: targetAdminId } });
    if (!targetAdmin) {
      throw new Error("Target administrator not found");
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDispute = await tx.dispute.update({
      where: { id: disputeId },
      data: { assignedAdminId: targetAdminId || null },
      include: {
        assignedAdmin: {
          select: { id: true, email: true, role: true },
        },
      },
    });

    await tx.disputeAuditLog.create({
      data: {
        disputeId,
        adminId,
        action: targetAdminId ? "ADMIN_ASSIGNED" : "ADMIN_UNASSIGNED",
        details: {
          assignedAdminId: targetAdminId || null,
          previousAssignedAdminId: dispute.assignedAdminId,
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: targetAdminId ? "DISPUTE_ASSIGNED" : "DISPUTE_UNASSIGNED",
        details: { disputeId, assignedAdminId: targetAdminId || null },
      },
    });

    return updatedDispute;
  });

  return updated;
};

/**
 * Update dispute status and record audit log & notifications
 */
const updateDisputeStatus = async (adminId, disputeId, status) => {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  if (dispute.isFinalized) {
    throw new Error("Finalized dispute status cannot be modified");
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

    // Record dispute audit log
    await tx.disputeAuditLog.create({
      data: {
        disputeId,
        adminId,
        action: "STATUS_CHANGED",
        previousStatus: dispute.status,
        newStatus: status,
        details: { previousStatus: dispute.status, newStatus: status },
      },
    });

    // Record admin audit log
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

  // User notifications
  const userIdsToNotify = [dispute.reporterId, dispute.reportedUserId].filter(Boolean);
  for (const userId of userIdsToNotify) {
    await createNotification({
      userId,
      title: "Dispute Status Updated",
      message: `The status of dispute #${disputeId.slice(-6)} has been updated to ${status}.`,
      type: "STATUS_UPDATE",
      link: `/disputes/${disputeId}`,
    }).catch((err) => console.error("Notification error:", err));
  }

  return updatedDispute;
};

/**
 * Add an internal administrative note to a dispute
 */
const addDisputeNote = async (adminId, disputeId, content) => {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  const note = await prisma.$transaction(async (tx) => {
    const createdNote = await tx.adminNote.create({
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

    await tx.disputeAuditLog.create({
      data: {
        disputeId,
        adminId,
        action: "NOTE_ADDED",
        details: { noteId: createdNote.id, snippet: content.slice(0, 50) },
      },
    });

    return createdNote;
  });

  return note;
};

/**
 * Get internal notes for a dispute
 */
const getDisputeNotes = async (disputeId, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

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
 * Send communication message on a dispute
 */
const sendDisputeMessage = async (adminId, disputeId, { message, attachments = [], isInternal = false }) => {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  const disputeMessage = await prisma.$transaction(async (tx) => {
    const createdMessage = await tx.disputeMessage.create({
      data: {
        disputeId,
        senderAdminId: adminId,
        message,
        attachments,
        isInternal,
      },
      include: {
        senderAdmin: { select: { id: true, email: true, role: true } },
      },
    });

    await tx.disputeAuditLog.create({
      data: {
        disputeId,
        adminId,
        action: isInternal ? "INTERNAL_NOTE_MESSAGE_ADDED" : "DISPUTE_MESSAGE_SENT",
        details: { messageId: createdMessage.id, isInternal },
      },
    });

    return createdMessage;
  });

  // Notify users if public communication
  if (!isInternal) {
    const userIdsToNotify = [dispute.reporterId, dispute.reportedUserId].filter(Boolean);
    for (const userId of userIdsToNotify) {
      await createNotification({
        userId,
        title: "New Dispute Communication",
        message: `An administrator sent a message regarding dispute #${disputeId.slice(-6)}.`,
        type: "MESSAGE",
        link: `/disputes/${disputeId}`,
      }).catch((err) => console.error("Notification error:", err));
    }
  }

  return disputeMessage;
};

/**
 * Get messages/communications for a dispute
 */
const getDisputeMessages = async (disputeId, query = {}) => {
  const { page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  const where = { disputeId };

  const [total, messages] = await Promise.all([
    prisma.disputeMessage.count({ where }),
    prisma.disputeMessage.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "asc" },
      include: {
        senderAdmin: { select: { id: true, email: true, role: true } },
        senderUser: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    }),
  ]);

  return {
    messages,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Request additional evidence from a user involved in a dispute
 */
const requestDisputeEvidence = async (adminId, disputeId, { requestedFrom, requestDetails, dueDate }) => {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  const targetUser = await prisma.userProfile.findUnique({ where: { id: requestedFrom } });
  if (!targetUser) {
    throw new Error("Requested user not found");
  }

  const evidenceRequest = await prisma.$transaction(async (tx) => {
    const createdRequest = await tx.disputeEvidenceRequest.create({
      data: {
        disputeId,
        adminId,
        requestedFrom,
        requestDetails,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: "PENDING",
      },
      include: {
        admin: { select: { id: true, email: true, role: true } },
        targetUser: { select: { id: true, displayName: true, email: true } },
      },
    });

    // Update dispute status to AWAITING_RESPONSE if currently OPEN or UNDER_REVIEW
    if (dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW") {
      await tx.dispute.update({
        where: { id: disputeId },
        data: { status: "AWAITING_RESPONSE" },
      });
    }

    await tx.disputeAuditLog.create({
      data: {
        disputeId,
        adminId,
        userId: requestedFrom,
        action: "EVIDENCE_REQUESTED",
        details: {
          requestId: createdRequest.id,
          requestDetails,
          dueDate,
        },
      },
    });

    return createdRequest;
  });

  // Notify requested user
  await createNotification({
    userId: requestedFrom,
    title: "Additional Evidence Requested",
    message: `An administrator has requested additional evidence for dispute #${disputeId.slice(-6)}: ${requestDetails}`,
    type: "SYSTEM",
    link: `/disputes/${disputeId}`,
  }).catch((err) => console.error("Notification error:", err));

  return evidenceRequest;
};

/**
 * Get evidence requests for a dispute
 */
const getDisputeEvidenceRequests = async (disputeId, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  const where = { disputeId };

  const [total, evidenceRequests] = await Promise.all([
    prisma.disputeEvidenceRequest.count({ where }),
    prisma.disputeEvidenceRequest.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      include: {
        admin: { select: { id: true, email: true, role: true } },
        targetUser: { select: { id: true, displayName: true, email: true } },
      },
    }),
  ]);

  return {
    evidenceRequests,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Record final dispute decision (read-only finalization)
 */
const recordDisputeDecision = async (adminId, disputeId, { resolutionSummary, outcome, supportingNotes, financialAdjustment = {} }) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { decision: true },
  });

  if (!dispute) {
    throw new Error("Dispute not found");
  }

  if (dispute.isFinalized || dispute.decision) {
    throw new Error("Dispute decision has already been finalized and cannot be modified");
  }

  const result = await prisma.$transaction(async (tx) => {
    const decision = await tx.disputeDecision.create({
      data: {
        disputeId,
        adminId,
        resolutionSummary,
        outcome,
        supportingNotes,
        financialAdjustment,
        resolvedAt: new Date(),
      },
      include: {
        admin: { select: { id: true, email: true, role: true } },
      },
    });

    const updatedDispute = await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status: "RESOLVED",
        isFinalized: true,
        resolvedAt: new Date(),
      },
    });

    await tx.disputeAuditLog.create({
      data: {
        disputeId,
        adminId,
        action: "DECISION_RECORDED",
        previousStatus: dispute.status,
        newStatus: "RESOLVED",
        details: {
          decisionId: decision.id,
          resolutionSummary,
          outcome,
          resolvedAt: decision.resolvedAt,
        },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: "DISPUTE_DECISION_RECORDED",
        details: { disputeId, decisionId: decision.id, outcome },
      },
    });

    return { decision, dispute: updatedDispute };
  });

  // Notify users of resolution
  const userIdsToNotify = [dispute.reporterId, dispute.reportedUserId].filter(Boolean);
  for (const userId of userIdsToNotify) {
    await createNotification({
      userId,
      title: "Dispute Resolved",
      message: `Dispute #${disputeId.slice(-6)} has been resolved: ${resolutionSummary}`,
      type: "STATUS_UPDATE",
      link: `/disputes/${disputeId}`,
    }).catch((err) => console.error("Notification error:", err));
  }

  return result;
};

/**
 * Retrieve dispute audit history
 */
const getDisputeAuditLogs = async (disputeId, query = {}) => {
  const { page = 1, limit = 20, sortOrder = "asc" } = query;
  const skip = (page - 1) * limit;

  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) {
    throw new Error("Dispute not found");
  }

  const where = { disputeId };
  const direction = sortOrder.toLowerCase() === "desc" ? "desc" : "asc";

  const [total, auditLogs] = await Promise.all([
    prisma.disputeAuditLog.count({ where }),
    prisma.disputeAuditLog.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: direction },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
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
    auditLogs,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

module.exports = {
  getDisputes,
  getDisputeById,
  assignDispute,
  updateDisputeStatus,
  addDisputeNote,
  getDisputeNotes,
  sendDisputeMessage,
  getDisputeMessages,
  requestDisputeEvidence,
  getDisputeEvidenceRequests,
  recordDisputeDecision,
  getDisputeAuditLogs,
};
