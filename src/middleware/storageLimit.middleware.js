const prisma = require("../config/prismaClient");
const supabase = require("../config/supabase");

const TIER_STORAGE_LIMITS_GB = {
  BASIC: 0.5,
  ADVANCE: 5.0,
  PRO: 25.0,
  ELITE: 100.0,
};

const calculateUserStorageBytes = async (userId) => {
  if (!supabase) return 0;

  const BUCKETS = ["user-avatars", "agreements", "project-files", "messaging-attachments"];
  let totalBytes = 0;

  for (const bucket of BUCKETS) {
    try {
      const { data } = await supabase.storage.from(bucket).list(userId, {
        limit: 1000,
        offset: 0,
      });
      if (data && Array.isArray(data)) {
        for (const item of data) {
          if (item.metadata && item.metadata.size) {
            totalBytes += item.metadata.size;
          }
        }
      }
    } catch (err) {
      // Ignore bucket list errors
    }
  }

  return totalBytes;
};

const checkStorageLimit = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // 1. Get user subscription tier
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: { tier: true },
    });

    const userProfile = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { tier: true },
    });

    const userTier = subscription?.tier || userProfile?.tier || "BASIC";
    const allowedGB = TIER_STORAGE_LIMITS_GB[userTier] || 0.5;
    const allowedBytes = allowedGB * 1024 * 1024 * 1024;

    // 2. Calculate current usage
    const usedBytes = await calculateUserStorageBytes(userId);
    const incomingBytes = req.file ? req.file.size : 0;

    if (usedBytes + incomingBytes > allowedBytes) {
      const limitLabel = allowedGB >= 1 ? `${allowedGB} GB` : `${allowedGB * 1000} MB`;
      return res.status(403).json({
        error: `Storage limit reached (${limitLabel}). Please upgrade your subscription plan to upload more files.`,
      });
    }

    next();
  } catch (error) {
    console.error("Error checking storage limit:", error);
    next(); // Fall through on error so uploads are not blocked by transient check failure
  }
};

module.exports = { checkStorageLimit, TIER_STORAGE_LIMITS_GB };
