const prisma = require("../../../config/prismaClient");

/**
 * Retrieve verification requests with search, filtering, sorting, and pagination.
 * FR: FRA72, FRA73, FRA74 | NFR: NFRA45, NFRA50
 */
const getVerificationRequests = async (filters = {}) => {
  const {
    page = 1,
    limit = 10,
    search,
    status,
    verificationType,
    submissionDateFrom,
    submissionDateTo,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filters;

  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

  const where = {};

  // Search by user name (displayName, legalName, firstName, lastName), user ID, or verification status
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { userId: { contains: search, mode: "insensitive" } },
      { verificationType: { contains: search, mode: "insensitive" } },
      { user: { displayName: { contains: search, mode: "insensitive" } } },
      { user: { legalName: { contains: search, mode: "insensitive" } } },
      { user: { firstName: { contains: search, mode: "insensitive" } } },
      { user: { lastName: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];

    // If search term matches status enum, include status filter
    const upperSearch = search.toUpperCase();
    if (["PENDING", "APPROVED", "REJECTED", "EXPIRED", "INCOMPLETE"].includes(upperSearch)) {
      where.OR.push({ status: upperSearch });
    }
  }

  // Filter by verification status
  if (status && status !== "All") {
    where.status = status;
  }

  // Filter by verification type
  if (verificationType && verificationType !== "All") {
    where.verificationType = { contains: verificationType, mode: "insensitive" };
  }

  // Filter by submission date range
  if (submissionDateFrom || submissionDateTo) {
    where.createdAt = {};
    if (submissionDateFrom) where.createdAt.gte = new Date(submissionDateFrom);
    if (submissionDateTo) where.createdAt.lte = new Date(submissionDateTo);
  }

  const allowedSorts = ["createdAt", "status", "verificationType", "updatedAt"];
  const sortField = allowedSorts.includes(sortBy) ? sortBy : "createdAt";

  const [total, requests] = await Promise.all([
    prisma.identityVerificationRequest.count({ where }),
    prisma.identityVerificationRequest.findMany({
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
            isVerified: true,
            identityVerified: true,
            accountStatus: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  // Aggregate summary counts for overview
  const [totalRequests, pendingCount, approvedCount, rejectedCount, incompleteCount, expiredCount] =
    await Promise.all([
      prisma.identityVerificationRequest.count(),
      prisma.identityVerificationRequest.count({ where: { status: "PENDING" } }),
      prisma.identityVerificationRequest.count({ where: { status: "APPROVED" } }),
      prisma.identityVerificationRequest.count({ where: { status: "REJECTED" } }),
      prisma.identityVerificationRequest.count({ where: { status: "INCOMPLETE" } }),
      prisma.identityVerificationRequest.count({ where: { status: "EXPIRED" } }),
    ]);

  return {
    summary: {
      totalRequests,
      pendingCount,
      approvedCount,
      rejectedCount,
      incompleteCount,
      expiredCount,
    },
    requests,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Retrieve full verification request details including identity documents, user profile, and previous verification attempts.
 * FR: FRA75, FRA76 | NFR: NFRA46, NFRA47, NFRA49
 */
const getVerificationDetails = async (requestId) => {
  const request = await prisma.identityVerificationRequest.findUnique({
    where: { id: requestId },
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
          isVerified: true,
          identityVerified: true,
          accountStatus: true,
          createdAt: true,
          lastActiveAt: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!request) {
    throw new Error("Verification request not found");
  }

  // Fetch previous verification attempts for this user (excluding the current request)
  const previousAttempts = await prisma.identityVerificationRequest.findMany({
    where: {
      userId: request.userId,
      id: { not: requestId },
    },
    orderBy: { createdAt: "desc" },
    include: {
      reviewedBy: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  return {
    request,
    previousAttempts,
    isReadOnly: true,
  };
};

/**
 * Process a verification decision (Approve or Reject).
 * Updates verification request, user profile status, creates user notification, and logs audit record.
 * FR: FRA77, FRA78, FRA79 | NFR: NFRA46, NFRA48, NFRA49
 */
const processVerificationDecision = async (adminId, requestId, payload) => {
  const { status, rejectionReason } = payload;

  const existingRequest = await prisma.identityVerificationRequest.findUnique({
    where: { id: requestId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  });

  if (!existingRequest) {
    throw new Error("Verification request not found");
  }

  if (status === "REJECTED" && (!rejectionReason || !rejectionReason.trim())) {
    throw new Error("A rejection reason is required when rejecting a verification request");
  }

  const reviewedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update verification request status
    const updatedRequest = await tx.identityVerificationRequest.update({
      where: { id: requestId },
      data: {
        status,
        rejectionReason: status === "REJECTED" ? rejectionReason.trim() : null,
        reviewedByAdminId: adminId,
        reviewedAt,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            isVerified: true,
            identityVerified: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // 2. Update user profile verified status
    await tx.userProfile.update({
      where: { id: existingRequest.userId },
      data: {
        identityVerified: status === "APPROVED",
        isVerified: status === "APPROVED" ? true : undefined,
      },
    });

    // 3. Create Notification for the user
    const notificationTitle =
      status === "APPROVED" ? "Identity Verification Approved" : "Identity Verification Rejected";

    const notificationMessage =
      status === "APPROVED"
        ? "Your identity verification request has been successfully reviewed and approved. Your profile now has verified status."
        : `Your identity verification request was reviewed and rejected. Reason: ${rejectionReason.trim()}`;

    await tx.notification.create({
      data: {
        userId: existingRequest.userId,
        title: notificationTitle,
        message: notificationMessage,
        type: "SYSTEM",
      },
    });

    // 4. Record Admin Audit Log
    const auditAction = status === "APPROVED" ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED";

    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: auditAction,
        targetUserId: existingRequest.userId,
        details: {
          requestId,
          previousStatus: existingRequest.status,
          newStatus: status,
          rejectionReason: status === "REJECTED" ? rejectionReason.trim() : null,
          verificationType: existingRequest.verificationType,
          reviewedAt,
        },
      },
    });

    return updatedRequest;
  });

  return result;
};

/**
 * Retrieve complete verification history for a specific user (or across users).
 * FR: FRA80, FRA81 | NFR: NFRA48, NFRA49
 */
const getUserVerificationHistory = async (userId, query = {}) => {
  const { page = 1, limit = 10, status, sortOrder = "desc" } = query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;
  const direction = sortOrder.toLowerCase() === "asc" ? "asc" : "desc";

  const where = {};
  if (userId) {
    where.userId = userId;
  }
  if (status && status !== "All") {
    where.status = status;
  }

  const [total, history] = await Promise.all([
    prisma.identityVerificationRequest.count({ where }),
    prisma.identityVerificationRequest.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: direction },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            legalName: true,
            avatarUrl: true,
          },
        },
        reviewedBy: {
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
    history,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Retrieve verification audit history recording all administrative actions performed on verification requests.
 * FR: FRA82 | NFR: NFRA48, NFRA49
 */
const getVerificationAuditHistory = async (query = {}) => {
  const { page = 1, limit = 10, search } = query;
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const skip = (pageNum - 1) * limitNum;

  const where = {
    action: { startsWith: "VERIFICATION_" },
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
            avatarUrl: true,
          },
        },
      },
    }),
  ]);

  return {
    auditLogs,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

module.exports = {
  getVerificationRequests,
  getVerificationDetails,
  processVerificationDecision,
  getUserVerificationHistory,
  getVerificationAuditHistory,
};
