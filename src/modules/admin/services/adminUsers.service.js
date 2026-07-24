const prisma = require("../../../config/prismaClient");
const bcrypt = require("bcryptjs");

const createAdmin = async ({ email, password, role }) => {
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email }
  });

  if (existingAdmin) {
    throw new Error("Admin user with this email already exists.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  return await prisma.adminUser.create({
    data: {
      email,
      password: hashedPassword,
      role
    },
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      createdAt: true
    }
  });
};

const getAdmins = async () => {
  return await prisma.adminUser.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      lastActiveAt: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });
};

const getAdminById = async (id) => {
  const admin = await prisma.adminUser.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      lastActiveAt: true,
      createdAt: true
    }
  });

  if (!admin) {
    throw new Error("Admin user not found");
  }

  return admin;
};

const updateAdmin = async (id, updateData) => {
  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) {
    throw new Error("Admin user not found");
  }

  // updateData should only contain allowed fields (role, accountStatus)
  // Password updates are explicitly excluded from this service method
  return await prisma.adminUser.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      updatedAt: true
    }
  });
};

const deactivateAdmin = async (id, requestingAdminId) => {
  if (id === requestingAdminId) {
    throw new Error("You cannot deactivate your own account. Another SUPER_ADMIN must perform this action.");
  }

  const admin = await prisma.adminUser.findUnique({ where: { id } });
  if (!admin) {
    throw new Error("Admin user not found");
  }

  return await prisma.adminUser.update({
    where: { id },
    data: {
      accountStatus: "DEACTIVATED",
      tokenVersion: { increment: 1 } // Invalidate current sessions
    },
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true
    }
  });
};

const getUsers = async (filters = {}) => {
  const { page = 1, limit = 10, search, accountStatus, isVerified, tier } = filters;
  const skip = (page - 1) * limit;

  const where = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { displayName: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { id: { contains: search, mode: "insensitive" } },
    ];
  }

  if (accountStatus) {
    where.accountStatus = accountStatus;
  }

  if (isVerified !== undefined) {
    where.isVerified = isVerified === 'true' || isVerified === true;
  }

  if (tier) {
    where.tier = tier;
  }

  const [total, users, statsTotal, statsActive, statsSuspended, statsBanned, statsPending] = await Promise.all([
    prisma.userProfile.count({ where }),
    prisma.userProfile.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isVerified: true,
        identityVerified: true,
        accountStatus: true,
        openToCollaborate: true,
        tier: true,
        createdAt: true,
      },
    }),
    prisma.userProfile.count(),
    prisma.userProfile.count({ where: { accountStatus: "ACTIVE" } }),
    prisma.userProfile.count({ where: { accountStatus: "SUSPENDED" } }),
    prisma.userProfile.count({ where: { accountStatus: "BANNED" } }),
    prisma.userProfile.count({ where: { isVerified: false } }),
  ]);

  return {
    users,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
    stats: {
      totalUsers: statsTotal,
      active: statsActive,
      suspended: statsSuspended,
      pendingVerif: statsPending,
      banned: statsBanned,
    }
  };
};

const getUserById = async (id) => {
  const user = await prisma.userProfile.findUnique({
    where: { id },
    include: {
      subscription: true,
      wallet: true,
      _count: {
        select: {
          ownedProjects: true,
          collaborations: true,
        }
      }
    }
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Remove sensitive fields
  delete user.password;
  delete user.twoFactorSecret;
  
  return user;
};

const getUserActivity = async (id, query = {}) => {
  const { page = 1, limit = 10, search, type } = query;
  const skip = (page - 1) * limit;

  const where = { userId: id };
  if (type && type !== "All") {
    where.action = { contains: type, mode: 'insensitive' };
  }
  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, activities] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    })
  ]);

  return {
    activities,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const getUserReports = async (id, query = {}) => {
  const { page = 1, limit = 10, search, type } = query;
  const skip = (page - 1) * limit;

  const where = { reportedUserId: id };
  if (type && type !== "All") {
    where.reason = { contains: type, mode: 'insensitive' };
  }
  if (search) {
    where.OR = [
      { reason: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    })
  ]);

  return {
    reports,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const getUserAuditHistory = async (id, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where = {
    userId: id
  };

  const [total, audits] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { createdAt: "desc" },
    })
  ]);

  return {
    audits,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const getUserNotes = async (id, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const skip = (page - 1) * limit;

  const where = {
    targetUserId: id
  };

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
            role: true
          }
        }
      }
    })
  ]);

  return {
    notes,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};

const addAdminNote = async (adminId, targetUserId, content) => {
  return await prisma.adminNote.create({
    data: {
      adminId,
      targetUserId,
      content
    },
    include: {
      admin: {
        select: {
          id: true,
          email: true,
          role: true
        }
      }
    }
  });
};

const moderateUser = async (userId, adminId, action, reason, notes, ipAddress, userAgent) => {
  let newStatus;
  switch (action.toLowerCase()) {
    case 'suspend':
      newStatus = 'SUSPENDED';
      break;
    case 'ban':
      newStatus = 'BANNED';
      break;
    case 'reactivate':
      newStatus = 'ACTIVE';
      break;
    default:
      throw new Error(`Invalid action: ${action}`);
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Update user status
    const updatedUser = await tx.userProfile.update({
      where: { id: userId },
      data: { accountStatus: newStatus }
    });

    // 2. Create audit log
    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: `User Moderation: ${action}`,
        details: { reason, newStatus, targetUserId: userId },
        ipAddress,
        userAgent
      }
    });

    // 3. Create admin note if provided
    if (notes) {
      await tx.adminNote.create({
        data: {
          adminId,
          targetUserId: userId,
          content: notes
        }
      });
    }

    return updatedUser;
  });
};

module.exports = {
  createAdmin,
  getAdmins,
  getAdminById,
  updateAdmin,
  deactivateAdmin,
  getUsers,
  getUserById,
  getUserActivity,
  getUserReports,
  getUserAuditHistory,
  getUserNotes,
  addAdminNote,
  moderateUser
};
