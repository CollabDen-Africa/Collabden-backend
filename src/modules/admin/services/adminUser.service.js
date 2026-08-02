const prisma = require("../../../config/prismaClient");
const { publishEvent } = require("../../../events/publisher");
const EVENT_TYPES = require("../../../events/eventTypes");

/**
 * List all users with filtering, search, and pagination.
 */
const listUsers = async (filters = {}, pagination = {}) => {
  const { search, accountStatus, verificationStatus, subscriptionPlan, openToCollaborate, dateJoinedStart, dateJoinedEnd } = filters;
  const page = parseInt(pagination.page) || 1;
  const limit = parseInt(pagination.limit) || 10;
  const skip = (page - 1) * limit;

  const where = {};

  // Search filter (id, email, displayName, firstName, lastName)
  if (search) {
    where.OR = [
      { id: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  // Account status filter
  if (accountStatus) {
    where.accountStatus = accountStatus;
  }

  // Verification status filter
  if (verificationStatus) {
    if (verificationStatus === "APPROVED" || verificationStatus === "verified" || verificationStatus === "true") {
      where.identityVerified = true;
    } else if (verificationStatus === "UNVERIFIED" || verificationStatus === "unverified" || verificationStatus === "false") {
      where.identityVerified = false;
    } else if (verificationStatus === "PENDING") {
      where.identityVerificationRequests = {
        some: { status: "PENDING" }
      };
      where.identityVerified = false;
    } else if (verificationStatus === "REJECTED") {
      where.identityVerificationRequests = {
        some: { status: "REJECTED" }
      };
      where.identityVerified = false;
    }
  }

  // Subscription plan filter
  if (subscriptionPlan) {
    where.tier = subscriptionPlan;
  }

  // Open to Collaborate status filter
  if (openToCollaborate !== undefined) {
    where.openToCollaborate = openToCollaborate === "true" || openToCollaborate === true;
  }

  // Date joined filter
  if (dateJoinedStart || dateJoinedEnd) {
    where.createdAt = {};
    if (dateJoinedStart) {
      where.createdAt.gte = new Date(dateJoinedStart);
    }
    if (dateJoinedEnd) {
      where.createdAt.lte = new Date(dateJoinedEnd);
    }
  }

  const [users, totalCount] = await Promise.all([
    prisma.userProfile.findMany({
      where,
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        accountStatus: true,
        identityVerified: true,
        tier: true,
        openToCollaborate: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.userProfile.count({ where }),
  ]);

  return {
    users,
    pagination: {
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  };
};

/**
 * Get detailed user profile.
 */
const getUserById = async (userId) => {
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    include: {
      subscription: true,
      wallet: {
        select: {
          id: true,
          balance: true,
          currency: true,
        }
      },
      identityVerificationRequests: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      _count: {
        select: {
          ownedProjects: true,
          collaborations: true,
        }
      }
    }
  });

  if (user) {
    delete user.password;
    delete user.twoFactorSecret;
  }

  return user;
};

/**
 * Create an admin note on a user profile.
 */
const createNote = async (userId, adminId, content) => {
  // Verify user exists
  const userExists = await prisma.userProfile.findUnique({ where: { id: userId } });
  if (!userExists) {
    throw new Error("User not found");
  }

  const note = await prisma.adminNote.create({
    data: {
      userId,
      adminId,
      content,
    },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          role: true,
        }
      }
    }
  });

  // Log the action
  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: "ADMIN_NOTE_CREATED",
      targetUserId: userId,
      details: { noteId: note.id },
    }
  });

  return note;
};

/**
 * Retrieve admin notes for a user profile.
 */
const getNotes = async (userId) => {
  const notes = await prisma.adminNote.findMany({
    where: { userId },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          role: true,
        }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  return notes;
};

/**
 * Retrieve user audit history (administrative logs).
 */
const getAuditHistory = async (userId) => {
  const logs = await prisma.adminAuditLog.findMany({
    where: { targetUserId: userId },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          role: true,
        }
      }
    },
    orderBy: { createdAt: "desc" },
  });

  return logs;
};

/**
 * Perform user moderation.
 */
const moderateUser = async (userId, adminId, action, reason, ipAddress = null, userAgent = null) => {
  const user = await prisma.userProfile.findUnique({
    where: { id: userId },
    select: { id: true, accountStatus: true, tokenVersion: true }
  });

  if (!user) {
    throw new Error("User not found");
  }

  let dbStatus;
  switch (action) {
    case "SUSPEND":
      dbStatus = "SUSPENDED";
      break;
    case "RESTRICT":
      dbStatus = "RESTRICTED";
      break;
    case "REACTIVATE":
      dbStatus = "ACTIVE";
      break;
    case "BAN":
      dbStatus = "BANNED";
      break;
    default:
      throw new Error("Invalid moderation action");
  }

  // Perform status update
  const updateData = { accountStatus: dbStatus };
  
  // Force token invalidation on suspension or ban
  if (action === "SUSPEND" || action === "BAN") {
    updateData.tokenVersion = user.tokenVersion + 1;
  }

  const updatedUser = await prisma.userProfile.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      displayName: true,
      accountStatus: true,
      tier: true,
    }
  });

  // Log in AdminAuditLog
  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: `USER_${action}ED`,
      targetUserId: userId,
      details: { reason, previousStatus: user.accountStatus, newStatus: dbStatus },
      ipAddress,
      userAgent,
    }
  });

  // Publish event for real-time notification
  await publishEvent(EVENT_TYPES.USER_MODERATED, {
    userId,
    action,
    reason,
  });

  return updatedUser;
};

/**
 * Aggregates all user activity history into a unified chronological feed.
 */
const getUserActivityFeed = async (userId) => {
  // Check user exists
  const userExists = await prisma.userProfile.findUnique({ where: { id: userId } });
  if (!userExists) {
    throw new Error("User not found");
  }

  // 1. Logins
  const logins = await prisma.loginActivity.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 2. Owned Projects
  const ownedProjects = await prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 3. Project Collaborations
  const collaborations = await prisma.projectCollaborator.findMany({
    where: { userId },
    include: { project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 4. Project Applications
  const applications = await prisma.projectApplication.findMany({
    where: { applicantId: userId },
    include: { project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 5. Verification Requests
  const verifications = await prisma.identityVerificationRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 6. Transactions & Payment Records
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Unify and sort
  const feed = [];

  logins.forEach(l => {
    feed.push({
      type: "LOGIN",
      description: `Login attempt: ${l.status}`,
      details: { ipAddress: l.ipAddress, userAgent: l.userAgent },
      timestamp: l.createdAt,
    });
  });

  ownedProjects.forEach(p => {
    feed.push({
      type: "PROJECT_CREATED",
      description: `Created project "${p.name}"`,
      details: { projectId: p.id, visibility: p.visibility },
      timestamp: p.createdAt,
    });
  });

  collaborations.forEach(c => {
    feed.push({
      type: "COLLABORATION_JOINED",
      description: `Joined project "${c.project?.name || 'Unknown'}" as collaborator`,
      details: { projectId: c.projectId, role: c.role },
      timestamp: c.createdAt,
    });
  });

  applications.forEach(a => {
    feed.push({
      type: "PROJECT_APPLICATION",
      description: `Submitted application to "${a.project?.name || 'Unknown'}" (Status: ${a.status})`,
      details: { applicationId: a.id, projectId: a.projectId },
      timestamp: a.createdAt,
    });
  });

  verifications.forEach(v => {
    feed.push({
      type: "IDENTITY_VERIFICATION",
      description: `Identity verification request updated to: ${v.status}`,
      details: { requestId: v.id, notes: v.notes },
      timestamp: v.updatedAt,
    });
  });

  transactions.forEach(t => {
    feed.push({
      type: "PAYMENT_TRANSACTION",
      description: `Transaction of ${t.amount} ${t.currency} (${t.type}) - ${t.status}`,
      details: { transactionId: t.id, reference: t.reference },
      timestamp: t.createdAt,
    });
  });

  // Sort feed chronologically, descending
  feed.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return feed;
};

module.exports = {
  listUsers,
  getUserById,
  createNote,
  getNotes,
  getAuditHistory,
  moderateUser,
  getUserActivityFeed,
};
