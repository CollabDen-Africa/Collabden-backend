const prisma = require("../config/prismaClient");
const { ACCOUNT_STATUS } = require("../config/constants");
const { getJwtConfig, verifyJwt } = require("../utils/jwt");

const createAuthMiddleware = ({ prismaClient = prisma, jwtConfig } = {}) => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token, unauthorized" });
    }
    const decoded = verifyJwt(authHeader.slice("Bearer ".length), "user", jwtConfig || getJwtConfig());
    const user = await prismaClient.userProfile.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, accountStatus: true, lastActiveAt: true },
    });
    if (!user) return res.status(401).json({ message: "User not found" });
    if (user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
      return res.status(401).json({ message: "Account is not active" });
    }
    const inactivityTimeout = 30 * 60 * 1000;
    if (user.lastActiveAt && Date.now() - user.lastActiveAt.getTime() > inactivityTimeout) {
      await prismaClient.userProfile.update({ where: { id: decoded.id }, data: { tokenVersion: { increment: 1 } } });
      return res.status(401).json({ message: "Session timed out due to inactivity. Please log in again" });
    }
    if (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion) {
      return res.status(401).json({ message: "Session expired. Please log in again" });
    }
    await prismaClient.userProfile.update({ where: { id: decoded.id }, data: { lastActiveAt: new Date() } });
    req.user = decoded;
    return next();
  } catch (error) {
    if (["TokenExpiredError", "NotBeforeError", "JsonWebTokenError"].includes(error.name)) {
      return res.status(401).json({ message: error.name === "TokenExpiredError" ? "Token expired, please log in again" : "Invalid token" });
    }
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const authMiddleware = createAuthMiddleware();
module.exports = { authMiddleware, createAuthMiddleware };
