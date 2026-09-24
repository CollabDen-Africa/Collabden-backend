const prisma = require("../config/prismaClient");
const { ACCOUNT_STATUS } = require("../config/constants");
const { getJwtConfig, verifyJwt } = require("../utils/jwt");

const createAdminMiddleware = ({ prismaClient = prisma, jwtConfig } = {}) => (allowedRoles = []) => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token, unauthorized" });
    }
    const decoded = verifyJwt(authHeader.slice("Bearer ".length), undefined, jwtConfig || getJwtConfig());
    // A correctly signed user token is never upgraded to an admin token.
    if (decoded.tokenType !== "admin" || !decoded.isAdminAuth) {
      return res.status(403).json({ message: "Forbidden: Admin token required" });
    }
    const admin = await prismaClient.adminUser.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, tokenVersion: true, accountStatus: true, lastActiveAt: true },
    });
    if (!admin) return res.status(401).json({ message: "Admin user not found" });
    if (admin.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
      return res.status(401).json({ message: "Admin account is not active" });
    }
    const inactivityTimeout = 30 * 60 * 1000;
    if (admin.lastActiveAt && Date.now() - admin.lastActiveAt.getTime() > inactivityTimeout) {
      await prismaClient.adminUser.update({ where: { id: admin.id }, data: { tokenVersion: { increment: 1 } } });
      return res.status(401).json({ message: "Session timed out due to inactivity. Please log in again" });
    }
    if (decoded.tokenVersion !== undefined && admin.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ message: "Session expired. Please log in again" });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(admin.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient role permissions" });
    }
    await prismaClient.adminUser.update({ where: { id: admin.id }, data: { lastActiveAt: new Date() } });
    req.user = admin;
    return next();
  } catch (error) {
    if (["TokenExpiredError", "NotBeforeError", "JsonWebTokenError"].includes(error.name)) {
      return res.status(401).json({ message: error.name === "TokenExpiredError" ? "Token expired, please log in again" : "Invalid token" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

const adminMiddleware = createAdminMiddleware();
module.exports = { adminMiddleware, createAdminMiddleware };
