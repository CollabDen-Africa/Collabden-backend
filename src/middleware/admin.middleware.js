const prisma = require('../config/prismaClient');

const adminMiddleware = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not identified" });
    }

    const user = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { adminMiddleware };
