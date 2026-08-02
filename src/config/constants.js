const TIER_LIMITS = {
  BASIC: {
    MAX_COLLABORATORS: 5,
    MAX_PROJECTS: 3,
    STORAGE_LIMIT_MB: 500,
    UPLOAD_LIMIT_MB: 50,
  },
  ADVANCE: {
    MAX_COLLABORATORS: 15,
    MAX_PROJECTS: 10,
    STORAGE_LIMIT_MB: 5000,
    UPLOAD_LIMIT_MB: 100,
  },
  PRO: {
    MAX_COLLABORATORS: 50,
    MAX_PROJECTS: -1, // Unlimited
    STORAGE_LIMIT_MB: 25000, // 25GB
    UPLOAD_LIMIT_MB: 500,
  },
  ELITE: {
    MAX_COLLABORATORS: -1, // Unlimited
    MAX_PROJECTS: -1, // Unlimited
    STORAGE_LIMIT_MB: 100000, // 100GB
    UPLOAD_LIMIT_MB: 1000,
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
  SUSPENDED: 'SUSPENDED',
  BANNED: 'BANNED',
  RESTRICTED: 'RESTRICTED',
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

const ADMIN_PERMISSIONS = {
  // User management
  USERS_VIEW: 'users.view',
  USERS_MODERATE: 'users.moderate',
  USERS_ADD_NOTES: 'users.add_notes',
  USERS_VIEW_ACTIVITY: 'users.view_activity',
  USERS_VIEW_REPORTS: 'users.view_reports',
  USERS_VIEW_AUDIT: 'users.view_audit',

  // Admin management
  ADMINS_VIEW: 'admins.view',
  ADMINS_CREATE: 'admins.create',
  ADMINS_UPDATE_ROLE: 'admins.update_role',
  ADMINS_DEACTIVATE: 'admins.deactivate',

  // Permissions management
  PERMISSIONS_VIEW: 'permissions.view',
  PERMISSIONS_MANAGE: 'permissions.manage',

  // Finance
  FINANCE_VIEW: 'finance.view',
  FINANCE_MANAGE: 'finance.manage',

  // Verification
  VERIFICATION_VIEW: 'verification.view',
  VERIFICATION_MANAGE: 'verification.manage',

  // Marketplace
  MARKETPLACE_VIEW: 'marketplace.view',
  MARKETPLACE_MODERATE: 'marketplace.moderate',

  // Projects
  PROJECTS_VIEW: 'projects.view',
  PROJECTS_MANAGE: 'projects.manage',

  // Subscriptions
  SUBSCRIPTIONS_VIEW: 'subscriptions.view',
  SUBSCRIPTIONS_MANAGE: 'subscriptions.manage',
};

const ADMIN_MODULES = {
  DASHBOARD: 'dashboard',
  USER_MANAGEMENT: 'user_management',
  ADMIN_MANAGEMENT: 'admin_management',
  PERMISSIONS: 'permissions',
  FINANCE: 'finance',
  VERIFICATION: 'verification',
  MARKETPLACE: 'marketplace',
  PROJECTS: 'projects',
  SUBSCRIPTIONS: 'subscriptions',
  MESSAGING: 'messaging',
  NOTIFICATIONS: 'notifications',
  ESCROW: 'escrow',
  REPORTS: 'reports',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
};

module.exports = {
  TIER_LIMITS,
  ALLOWED_MIMETYPES,
  ACCOUNT_STATUS,
  LOGIN_STATUS,
  DATA_EXPORT_STATUS,
  SUPPORT_TICKET_STATUS,
  ADMIN_PERMISSIONS,
  ADMIN_MODULES,
};
