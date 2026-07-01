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

const ACCOUNT_STATUS = {
  ACTIVE: 'ACTIVE',
  DEACTIVATED: 'DEACTIVATED',
  DELETED: 'DELETED',
};

const LOGIN_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
};

const DATA_EXPORT_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

const SUPPORT_TICKET_STATUS = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
};

module.exports = {
  TIER_LIMITS,
  ALLOWED_MIMETYPES,
  ACCOUNT_STATUS,
  LOGIN_STATUS,
  DATA_EXPORT_STATUS,
  SUPPORT_TICKET_STATUS,
};
