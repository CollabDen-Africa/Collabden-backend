const jwt = require('jsonwebtoken');
const prisma = require('../config/prismaClient');
const { ACCOUNT_STATUS } = require('../config/constants');

/**
 * Middleware to protect admin routes and optionally restrict by roles.
 * @param {string[]} allowedRoles - Array of roles allowed to access the route. If empty, any admin can access.
 */
const adminMiddleware = (allowedRoles = []) => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token, unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure this token was issued specifically for an admin
    if (!decoded.isAdminAuth) {
      return res.status(403).json({ message: "Forbidden: Admin token required" });
    }

    const admin = await prisma.adminUser.findUnique({
      where: { id: decoded.id },
      select: { 
        id: true,
        email: true,
        role: true, 
        tokenVersion: true, 
        accountStatus: true, 
        lastActiveAt: true 
      },
    });

    if (!admin) {
      return res.status(401).json({ message: "Admin user not found" });
    }

    if (admin.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
      return res.status(401).json({ message: "Admin account is not active" });
    }

    // Check inactivity timeout (30 minutes)
    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
    if (admin.lastActiveAt && (Date.now() - admin.lastActiveAt.getTime() > INACTIVITY_TIMEOUT_MS)) {
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { tokenVersion: { increment: 1 } }
      });
      return res.status(401).json({ message: "Session timed out due to inactivity. Please log in again" });
    }

    if (
      decoded.tokenVersion !== undefined &&
      admin.tokenVersion !== decoded.tokenVersion
    ) {
      return res.status(401).json({ message: "Session expired. Please log in again" });
    }

    // Role verification
    if (allowedRoles.length > 0 && !allowedRoles.includes(admin.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient role permissions" });
    }

    // Update lastActiveAt to keep session alive
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastActiveAt: new Date() }
    });

    req.user = admin;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired, please log in again" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    console.error("Admin middleware error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { adminMiddleware };
