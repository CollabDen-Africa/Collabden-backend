const TIER_LIMITS = {
  FREE: {
    MAX_COLLABORATORS: 5,
    MAX_PROJECTS: 3,
    STORAGE_LIMIT_MB: 100,
    UPLOAD_LIMIT_MB: 10,
  },
  PREMIUM: {
    MAX_COLLABORATORS: 50,
    MAX_PROJECTS: -1, // Unlimited
    STORAGE_LIMIT_MB: 5000, // 5GB
    UPLOAD_LIMIT_MB: 100,
  },
};
const ALLOWED_MIMETYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

module.exports = {
  TIER_LIMITS,
  ALLOWED_MIMETYPES,
};
