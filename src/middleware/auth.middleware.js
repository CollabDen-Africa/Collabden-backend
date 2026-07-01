const jwt = require('jsonwebtoken')
const prisma = require("../config/prismaClient");
const { ACCOUNT_STATUS } = require("../config/constants");
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token, unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.userProfile.findUnique({
      where: { id: decoded.id },
      select: { tokenVersion: true, accountStatus: true },
    });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if (user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
      return res.status(401).json({ message: "Account is not active" });
    }

    // For backward compatibility, decoded.tokenVersion might be undefined for old tokens.
    // We will reject if decoded.tokenVersion exists and is different, or just require a new login if they logged out.
    if (
      decoded.tokenVersion !== undefined &&
      user.tokenVersion !== decoded.tokenVersion
    ) {
      return res
        .status(401)
        .json({ message: "Session expired. Please log in again" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token expired, please log in again" });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    return res.status(500).json({ message: "Something went wrong" });
  }
};
module.exports = { authMiddleware };