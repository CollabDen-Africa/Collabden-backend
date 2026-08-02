const prisma = require("../../../config/prismaClient");
const { AdminRole } = require("@prisma/client");
const { ADMIN_PERMISSIONS, ADMIN_MODULES } = require("../../../config/constants");

// ──────────────────────────────────────────────
// Retrieve
// ──────────────────────────────────────────────

const getRolePermissions = async (role) => {
  if (!Object.values(AdminRole).includes(role)) {
    throw new Error("Invalid admin role provided.");
  }

  const roleConfig = await prisma.adminRoleConfig.findUnique({
    where: { role }
  });

  // Count admins assigned to this role
  const assignedAdmins = await prisma.adminUser.count({
    where: { role }
  });

  if (!roleConfig) {
    return {
      role,
      permissions: [],
      modules: [],
      assignedAdmins
    };
  }

  return {
    ...roleConfig,
    assignedAdmins
  };
};

const getAllRolePermissions = async () => {
  const [configs, roleCounts] = await Promise.all([
    prisma.adminRoleConfig.findMany(),
    prisma.adminUser.groupBy({
      by: ['role'],
      _count: { id: true }
    })
  ]);

  // Build role count map
  const countMap = roleCounts.reduce((acc, curr) => {
    acc[curr.role] = curr._count.id;
    return acc;
  }, {});

  // Build config map
  const configMap = configs.reduce((acc, curr) => {
    acc[curr.role] = curr;
    return acc;
  }, {});

  return Object.values(AdminRole).map((role) => {
    const config = configMap[role] || { role, permissions: [], modules: [] };
    return {
      ...config,
      assignedAdmins: countMap[role] || 0
    };
  });
};

const getAvailablePermissionsAndModules = () => {
  // Group permissions by category for the dashboard
  const permissionsByCategory = {};
  for (const [key, value] of Object.entries(ADMIN_PERMISSIONS)) {
    const category = value.split('.')[0];
    if (!permissionsByCategory[category]) {
      permissionsByCategory[category] = [];
    }
    permissionsByCategory[category].push({
      key,
      value,
      label: key.replace(/_/g, ' ').toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase())
    });
  }

  const modulesList = Object.entries(ADMIN_MODULES).map(([key, value]) => ({
    key,
    value,
    label: key.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase())
  }));

  return {
    permissions: ADMIN_PERMISSIONS,
    permissionsByCategory,
    modules: ADMIN_MODULES,
    modulesList,
    totalPermissions: Object.keys(ADMIN_PERMISSIONS).length,
    totalModules: Object.keys(ADMIN_MODULES).length
  };
};

// ──────────────────────────────────────────────
// Assign / Update Permissions
// ──────────────────────────────────────────────

const updateRolePermissions = async (role, permissions, modules, auditContext = {}) => {
  if (!Object.values(AdminRole).includes(role)) {
    throw new Error("Invalid admin role provided.");
  }

  if (!Array.isArray(permissions) || !Array.isArray(modules)) {
    throw new Error("Permissions and modules must be arrays of strings.");
  }

  // Validate permission values
  const validPermissions = Object.values(ADMIN_PERMISSIONS);
  const invalidPerms = permissions.filter(p => !validPermissions.includes(p));
  if (invalidPerms.length > 0) {
    throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}. Use GET /permissions/available to see valid keys.`);
  }

  // Validate module values
  const validModules = Object.values(ADMIN_MODULES);
  const invalidMods = modules.filter(m => !validModules.includes(m));
  if (invalidMods.length > 0) {
    throw new Error(`Invalid modules: ${invalidMods.join(', ')}. Use GET /permissions/available to see valid keys.`);
  }

  // Fetch current config for audit comparison
  const currentConfig = await prisma.adminRoleConfig.findUnique({
    where: { role }
  });

  const result = await prisma.$transaction(async (tx) => {
    const updatedConfig = await tx.adminRoleConfig.upsert({
      where: { role },
      update: {
        permissions,
        modules
      },
      create: {
        role,
        permissions,
        modules
      }
    });

    // Record permission change in audit log
    if (auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "ROLE_PERMISSIONS_UPDATED",
          details: {
            role,
            previous: {
              permissions: currentConfig?.permissions || [],
              modules: currentConfig?.modules || []
            },
            updated: {
              permissions,
              modules
            }
          },
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null
        }
      });
    }

    return updatedConfig;
  });

  return result;
};

const addPermissionsToRole = async (role, permissionsToAdd, auditContext = {}) => {
  if (!Object.values(AdminRole).includes(role)) {
    throw new Error("Invalid admin role provided.");
  }

  if (!Array.isArray(permissionsToAdd) || permissionsToAdd.length === 0) {
    throw new Error("permissionsToAdd must be a non-empty array of permission strings.");
  }

  // Validate permission values
  const validPermissions = Object.values(ADMIN_PERMISSIONS);
  const invalidPerms = permissionsToAdd.filter(p => !validPermissions.includes(p));
  if (invalidPerms.length > 0) {
    throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}. Use GET /permissions/available to see valid keys.`);
  }

  const currentConfig = await prisma.adminRoleConfig.findUnique({
    where: { role }
  });

  const currentPermissions = currentConfig?.permissions || [];
  // Merge without duplicates
  const merged = [...new Set([...currentPermissions, ...permissionsToAdd])];
  const added = permissionsToAdd.filter(p => !currentPermissions.includes(p));

  if (added.length === 0) {
    return {
      config: currentConfig || { role, permissions: currentPermissions, modules: [] },
      added: [],
      message: "All specified permissions are already assigned."
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedConfig = await tx.adminRoleConfig.upsert({
      where: { role },
      update: { permissions: merged },
      create: { role, permissions: merged, modules: [] }
    });

    if (auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "ROLE_PERMISSIONS_ADDED",
          details: { role, addedPermissions: added },
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null
        }
      });
    }

    return updatedConfig;
  });

  return { config: result, added };
};

const removePermissionsFromRole = async (role, permissionsToRemove, auditContext = {}) => {
  if (!Object.values(AdminRole).includes(role)) {
    throw new Error("Invalid admin role provided.");
  }

  if (!Array.isArray(permissionsToRemove) || permissionsToRemove.length === 0) {
    throw new Error("permissionsToRemove must be a non-empty array of permission strings.");
  }

  const currentConfig = await prisma.adminRoleConfig.findUnique({
    where: { role }
  });

  if (!currentConfig) {
    throw new Error("Role config not found. No configuration exists for this role.");
  }

  const removed = permissionsToRemove.filter(p => currentConfig.permissions.includes(p));
  const remaining = currentConfig.permissions.filter(p => !permissionsToRemove.includes(p));

  if (removed.length === 0) {
    return {
      config: currentConfig,
      removed: [],
      message: "None of the specified permissions were assigned to this role."
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedConfig = await tx.adminRoleConfig.update({
      where: { role },
      data: { permissions: remaining }
    });

    if (auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "ROLE_PERMISSIONS_REMOVED",
          details: { role, removedPermissions: removed },
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null
        }
      });
    }

    return updatedConfig;
  });

  return { config: result, removed };
};

// ──────────────────────────────────────────────
// Module Access Management
// ──────────────────────────────────────────────

const addModulesToRole = async (role, modulesToAdd, auditContext = {}) => {
  if (!Object.values(AdminRole).includes(role)) {
    throw new Error("Invalid admin role provided.");
  }

  if (!Array.isArray(modulesToAdd) || modulesToAdd.length === 0) {
    throw new Error("modulesToAdd must be a non-empty array of module strings.");
  }

  // Validate module values
  const validModules = Object.values(ADMIN_MODULES);
  const invalidMods = modulesToAdd.filter(m => !validModules.includes(m));
  if (invalidMods.length > 0) {
    throw new Error(`Invalid modules: ${invalidMods.join(', ')}. Use GET /permissions/available to see valid keys.`);
  }

  const currentConfig = await prisma.adminRoleConfig.findUnique({
    where: { role }
  });

  const currentModules = currentConfig?.modules || [];
  const merged = [...new Set([...currentModules, ...modulesToAdd])];
  const added = modulesToAdd.filter(m => !currentModules.includes(m));

  if (added.length === 0) {
    return {
      config: currentConfig || { role, permissions: [], modules: currentModules },
      added: [],
      message: "All specified modules are already assigned."
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedConfig = await tx.adminRoleConfig.upsert({
      where: { role },
      update: { modules: merged },
      create: { role, permissions: [], modules: merged }
    });

    if (auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "ROLE_MODULES_ADDED",
          details: { role, addedModules: added },
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null
        }
      });
    }

    return updatedConfig;
  });

  return { config: result, added };
};

const removeModulesFromRole = async (role, modulesToRemove, auditContext = {}) => {
  if (!Object.values(AdminRole).includes(role)) {
    throw new Error("Invalid admin role provided.");
  }

  if (!Array.isArray(modulesToRemove) || modulesToRemove.length === 0) {
    throw new Error("modulesToRemove must be a non-empty array of module strings.");
  }

  const currentConfig = await prisma.adminRoleConfig.findUnique({
    where: { role }
  });

  if (!currentConfig) {
    throw new Error("Role config not found. No configuration exists for this role.");
  }

  const removed = modulesToRemove.filter(m => currentConfig.modules.includes(m));
  const remaining = currentConfig.modules.filter(m => !modulesToRemove.includes(m));

  if (removed.length === 0) {
    return {
      config: currentConfig,
      removed: [],
      message: "None of the specified modules were assigned to this role."
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedConfig = await tx.adminRoleConfig.update({
      where: { role },
      data: { modules: remaining }
    });

    if (auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "ROLE_MODULES_REMOVED",
          details: { role, removedModules: removed },
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null
        }
      });
    }

    return updatedConfig;
  });

  return { config: result, removed };
};

// ──────────────────────────────────────────────
// Delete Role Config
// ──────────────────────────────────────────────

const deleteRoleConfig = async (role, auditContext = {}) => {
  if (!Object.values(AdminRole).includes(role)) {
    throw new Error("Invalid admin role provided.");
  }

  // Prevent deletion if any admin is currently assigned this role
  const assignedCount = await prisma.adminUser.count({
    where: { role }
  });

  if (assignedCount > 0) {
    throw new Error(
      `Cannot delete role config: ${assignedCount} admin(s) currently assigned the "${role}" role. Reassign them first.`
    );
  }

  const existingConfig = await prisma.adminRoleConfig.findUnique({
    where: { role }
  });

  if (!existingConfig) {
    throw new Error("Role config not found. No configuration exists for this role.");
  }

  return await prisma.$transaction(async (tx) => {
    await tx.adminRoleConfig.delete({
      where: { role }
    });

    // Record deletion in audit log
    if (auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "ROLE_CONFIG_DELETED",
          details: {
            role,
            deletedPermissions: existingConfig.permissions,
            deletedModules: existingConfig.modules
          },
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null
        }
      });
    }

    return { message: `Role config for "${role}" deleted successfully.` };
  });
};

// ──────────────────────────────────────────────
// Permission Change History
// ──────────────────────────────────────────────

const getPermissionChangeHistory = async (query = {}) => {
  const { page = 1, limit = 20, role } = query;
  const skip = (page - 1) * limit;

  const where = {
    action: {
      in: [
        "ROLE_PERMISSIONS_UPDATED",
        "ROLE_PERMISSIONS_ADDED",
        "ROLE_PERMISSIONS_REMOVED",
        "ROLE_MODULES_ADDED",
        "ROLE_MODULES_REMOVED",
        "ROLE_CONFIG_DELETED"
      ]
    }
  };

  // Filter by role if provided
  if (role) {
    where.details = { path: ['role'], equals: role };
  }

  const [total, logs] = await Promise.all([
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
            role: true
          }
        }
      }
    })
  ]);

  return {
    logs,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit)
  };
};

module.exports = {
  getRolePermissions,
  getAllRolePermissions,
  getAvailablePermissionsAndModules,
  updateRolePermissions,
  addPermissionsToRole,
  removePermissionsFromRole,
  addModulesToRole,
  removeModulesFromRole,
  deleteRoleConfig,
  getPermissionChangeHistory
};
