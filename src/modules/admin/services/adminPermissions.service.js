const prisma = require("../../../config/prismaClient");
const { AdminRole } = require("@prisma/client");

const getRolePermissions = async (role) => {
  if (!Object.values(AdminRole).includes(role)) {
    throw new Error("Invalid admin role provided.");
  }

  const roleConfig = await prisma.adminRoleConfig.findUnique({
    where: { role }
  });

  if (!roleConfig) {
    return {
      role,
      permissions: [],
      modules: []
    };
  }

  return roleConfig;
};

const getAllRolePermissions = async () => {
  const configs = await prisma.adminRoleConfig.findMany();
  
  // Create a map to ensure all roles from the enum are represented,
  // even if they don't have a DB entry yet.
  const configMap = configs.reduce((acc, curr) => {
    acc[curr.role] = curr;
    return acc;
  }, {});

  return Object.values(AdminRole).map((role) => {
    return configMap[role] || { role, permissions: [], modules: [] };
  });
};

const updateRolePermissions = async (role, permissions, modules) => {
  if (!Object.values(AdminRole).includes(role)) {
    throw new Error("Invalid admin role provided.");
  }

  if (!Array.isArray(permissions) || !Array.isArray(modules)) {
    throw new Error("Permissions and modules must be arrays of strings.");
  }

  return await prisma.adminRoleConfig.upsert({
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
};

module.exports = {
  getRolePermissions,
  getAllRolePermissions,
  updateRolePermissions
};
