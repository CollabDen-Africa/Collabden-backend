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
  CLOSED: 'CLOSED',
};

const SUPPORT_AUDIT_ACTIONS = {
  TICKET_CREATED: 'TICKET_CREATED',
  ASSIGNED: 'ASSIGNED',
  REASSIGNED: 'REASSIGNED',
  UNASSIGNED: 'UNASSIGNED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REPLY_SENT: 'REPLY_SENT',
  INTERNAL_NOTE_ADDED: 'INTERNAL_NOTE_ADDED',
  RESOLUTION_SET: 'RESOLUTION_SET',
  CATEGORY_CHANGED: 'CATEGORY_CHANGED',
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

  // Agreements
  AGREEMENTS_VIEW: 'agreements.view',
  AGREEMENTS_MANAGE: 'agreements.manage',

  // Subscriptions
  SUBSCRIPTIONS_VIEW: 'subscriptions.view',
  SUBSCRIPTIONS_MANAGE: 'subscriptions.manage',

  // Payments & Escrow
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_MANAGE: 'payments.manage',

  // Escrow
  ESCROW_VIEW: 'escrow.view',

  // Disputes
  DISPUTES_VIEW: 'disputes.view',
  DISPUTES_MANAGE: 'disputes.manage',

  // Support Tickets
  SUPPORT_TICKETS_VIEW: 'support_tickets.view',
  SUPPORT_TICKETS_MANAGE: 'support_tickets.manage',
  SUPPORT_TICKETS_AUDIT: 'support_tickets.audit',

  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
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
  AGREEMENTS: 'agreements',
  SUBSCRIPTIONS: 'subscriptions',
  MESSAGING: 'messaging',
  NOTIFICATIONS: 'notifications',
  ESCROW: 'escrow',
  REPORTS: 'reports',
  AUDIT_LOGS: 'audit_logs',
  SETTINGS: 'settings',
  SUPPORT_REQUESTS: 'support_requests',
};

const SETTINGS_CATEGORY_MAP = {
  // User & Account Settings
  phoneRequiredAtSignUp:     "Account Registration Requirements",
  dobRequired:               "Account Registration Requirements",
  stageNameRequired:         "Account Registration Requirements",
  agreeToTermsRequired:      "Account Registration Requirements",
  ageVerificationRequired:   "Account Registration Requirements",
  defaultProfileVisibility:  "Profile Visibility Rules",
  contactInfoVisibility:     "Profile Visibility Rules",
  allowUsersToSetPrivate:    "Profile Visibility Rules",
  showOnlineStatus:          "Profile Visibility Rules",
  allowSeeEachOthersConnections: "Profile Visibility Rules",
  verificationToSellOnMarketplace: "User Verification Requirements",
  verificationToWithdrawEarnings:  "User Verification Requirements",
  verificationToEnterEscrow:       "User Verification Requirements",
  showVerifiedBadge:               "User Verification Requirements",
  maxFailedLoginsBeforeLock:  "Account Restriction Settings",
  accountLockDuration:        "Account Restriction Settings",
  allowAdminsToSuspend:       "Account Restriction Settings",
  autoFlagUnusualActivity:    "Account Restriction Settings",

  // General Platform Settings
  platformName:          "Platform Branding",
  supportEmail:          "Platform Branding",
  primaryColor:          "Platform Branding",
  logoUrl:               "Platform Branding",
  defaultLanguage:       "Platform Preferences",
  defaultCurrency:       "Platform Preferences",
  timezone:              "Platform Preferences",
  allowNewRegistrations: "General Features",
  maintenanceMode:       "General Features",
  enableMarketplace:     "General Features",

  // Notification Settings
  emailNotificationsEnabled:  "Email Notifications",
  emailSenderName:            "Email Notifications",
  emailSenderAddress:         "Email Notifications",
  emailFooterText:            "Email Notifications",
  notifyOnNewRegistration:    "Email Notifications",
  notifyOnProjectInvite:      "Email Notifications",
  notifyOnPaymentReceived:    "Email Notifications",
  notifyOnAccountFlagged:     "Email Notifications",
  inAppNotificationsEnabled:  "In-App Notifications",
  notifyOnNewMessage:         "In-App Notifications",
  notifyOnConnectionRequest:  "In-App Notifications",
  notifyOnProjectUpdate:      "In-App Notifications",
  notifyOnMilestoneCompleted: "In-App Notifications",
  systemAnnouncementsEnabled: "System Announcements",
  activeAnnouncementTitle:    "System Announcements",
  activeAnnouncementBody:     "System Announcements",
  activeAnnouncementType:     "System Announcements",

  // Marketplace Settings
  listingApprovalRequired:          "Marketplace Availability",
  allowGuestBrowsing:               "Marketplace Availability",
  allowBuyerRegistrations:          "Marketplace Availability",
  allowSellerRegistrations:         "Marketplace Availability",
  maxActiveListingsPerUser:         "Project Posting Rules",
  requireProjectBudget:             "Project Posting Rules",
  requireProjectDeadline:           "Project Posting Rules",
  allowFixedPriceProjects:          "Project Posting Rules",
  allowHourlyProjects:              "Project Posting Rules",
  minimumProjectBudget:             "Project Posting Rules",
  projectPostingCooldownHours:      "Project Posting Rules",
  defaultCollaboratorVisibility:    "Collaboration Visibility",
  showCollaboratorRatings:          "Collaboration Visibility",
  showCollaboratorReviews:          "Collaboration Visibility",
  allowCollaboratorsToHideEarnings: "Collaboration Visibility",
  searchEnabled:                    "Search and Discovery",
  featuredListingsEnabled:          "Search and Discovery",
  allowSponsoredListings:           "Search and Discovery",
  searchResultsPerPage:             "Search and Discovery",
  enableLocationBasedSearch:        "Search and Discovery",
  enableSkillBasedSearch:           "Search and Discovery",
};

module.exports = {
  TIER_LIMITS,
  ALLOWED_MIMETYPES,
  ACCOUNT_STATUS,
  LOGIN_STATUS,
  DATA_EXPORT_STATUS,
  SUPPORT_TICKET_STATUS,
  SUPPORT_AUDIT_ACTIONS,
  ADMIN_PERMISSIONS,
  ADMIN_MODULES,
  SETTINGS_CATEGORY_MAP,
};
