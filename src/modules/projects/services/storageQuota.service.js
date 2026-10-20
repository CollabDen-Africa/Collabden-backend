const prisma = require("../../../config/prismaClient");
const {
  TIER_LIMITS,
  MAX_FILE_UPLOAD_MB,
} = require("../../../config/constants");

const MAX_FILE_UPLOAD_BYTES = MAX_FILE_UPLOAD_MB * 1024 * 1024;

const httpError = (message, status, code, extra) => {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  if (extra) Object.assign(err, extra);
  return err;
};

const getTierLimits = (tier) => TIER_LIMITS[tier] || TIER_LIMITS.BASIC;

const nextTier = (tier) => {
  switch (tier) {
    case "BASIC": return "ADVANCE";
    case "ADVANCE": return "PRO";
    case "PRO": return "ELITE";
    default: return null;
  }
};

const sumProjectFileBytes = async (ownerId) => {
  const result = await prisma.projectFileVersion.aggregate({
    _sum: { size: true },
    where: { file: { project: { ownerId } } },
  });
  return result._sum.size || 0;
};

const sumMessageAttachmentBytes = async (ownerId) => {
  const result = await prisma.projectMessageAttachment.aggregate({
    _sum: { size: true },
    where: { message: { project: { ownerId } } },
  });
  return result._sum.size || 0;
};

/**
 * Returns the full breakdown of bytes owned by a user across every project they own.
 * `filesBytes` counts every ProjectFileVersion (current + history).
 * `chatBytes` counts every ProjectMessageAttachment.
 */
const getOwnerStorageBreakdown = async (ownerId) => {
  const [filesBytes, chatBytes] = await Promise.all([
    sumProjectFileBytes(ownerId),
    sumMessageAttachmentBytes(ownerId),
  ]);
  return {
    filesBytes,
    chatBytes,
    totalBytes: filesBytes + chatBytes,
  };
};

const buildStoragePayload = async (owner) => {
  const limits = getTierLimits(owner.tier);
  const limitBytes = limits.STORAGE_LIMIT_MB * 1024 * 1024;
  const breakdown = await getOwnerStorageBreakdown(owner.id);
  return {
    tier: owner.tier,
    filesBytes: breakdown.filesBytes,
    chatBytes: breakdown.chatBytes,
    usedBytes: breakdown.totalBytes,
    totalBytes: breakdown.totalBytes,
    limitBytes,
    perFileLimitBytes: MAX_FILE_UPLOAD_BYTES,
    perFileLimitMB: MAX_FILE_UPLOAD_MB,
    versionRetention: limits.VERSION_RETENTION,
    usagePercent: limitBytes > 0 ? Math.round((breakdown.totalBytes / limitBytes) * 10000) / 100 : 0,
  };
};

/**
 * Guard an upload against the project owner's tier quota.
 * `perFileCapBytes` lets the caller impose a stricter cap than the global file cap
 * (e.g. chat attachments cap at 50 MB even though files allow 200 MB).
 */
const assertOwnerCanAbsorb = async ({
  owner,
  incomingBytes,
  perFileCapBytes = MAX_FILE_UPLOAD_BYTES,
  perFileCapLabel,
}) => {
  if (!Number.isFinite(incomingBytes) || incomingBytes <= 0) {
    throw httpError("Uploaded file size is invalid.", 400);
  }
  if (incomingBytes > perFileCapBytes) {
    const mb = Math.round(perFileCapBytes / 1024 / 1024);
    throw httpError(
      `${perFileCapLabel || "File"} is larger than the ${mb} MB per-file limit.`,
      413,
      "FILE_TOO_LARGE"
    );
  }

  const limits = getTierLimits(owner.tier);
  const limitBytes = limits.STORAGE_LIMIT_MB * 1024 * 1024;
  const breakdown = await getOwnerStorageBreakdown(owner.id);

  if (breakdown.totalBytes + incomingBytes > limitBytes) {
    throw httpError(
      `Storage limit reached for ${owner.tier} tier (${limits.STORAGE_LIMIT_MB} MB). Delete old files or upgrade to continue uploading.`,
      413,
      "STORAGE_LIMIT_EXCEEDED",
      {
        usedBytes: breakdown.totalBytes,
        filesBytes: breakdown.filesBytes,
        chatBytes: breakdown.chatBytes,
        limitBytes,
        upgradeTo: nextTier(owner.tier),
      }
    );
  }
};

module.exports = {
  getTierLimits,
  getOwnerStorageBreakdown,
  buildStoragePayload,
  assertOwnerCanAbsorb,
  nextTier,
  MAX_FILE_UPLOAD_BYTES,
};
