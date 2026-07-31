const prisma = require('../config/prismaClient');

/**
 * SUPER_ADMIN always has full access — no permission check needed
 * 
 * @param {string} requiredPermission
 */
const checkPermission = (requiredPermission) => async (req, res, next) => {
  try {
    const admin = req.user;

    if (!admin) {
      return res.status(401).json({ message: "Unauthorized: No admin context found" });
    }

    if (admin.role === 'SUPER_ADMIN') {
      return next();
    }

    // Look up the role's configured permissions
    const roleConfig = await prisma.adminRoleConfig.findUnique({
      where: { role: admin.role }
    });

    if (!roleConfig || !roleConfig.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        message: "Forbidden: You do not have the required permission for this action",
        requiredPermission
      });
    }

    next();
  } catch (error) {
    console.error("Permission check error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { checkPermission };
