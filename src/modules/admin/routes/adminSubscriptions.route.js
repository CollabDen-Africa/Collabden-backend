const { Router } = require("express");
const {
  getSubscriptionsController,
  getSubscriptionDetailsController,
  getUserBillingHistoryController,
  getSubscriptionActivityController,
  getFailedSubscriptionPaymentsController,
  getSubscriptionIssuesController,
  getSubscriptionIssueDetailsController,
  createSubscriptionIssueController,
  addSubscriptionIssueNoteController,
  updateSubscriptionIssueStatusController,
  getSubscriptionPlansController,
  getSubscriptionPlanByIdController,
  updateSubscriptionPlanController,
  getSubscriptionReportsController,
  getSubscriptionAuditHistoryController,
} = require("../controllers/adminSubscriptions.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

// All routes require admin authentication
router.use(adminMiddleware());

// ──────────────────────────────────────────────
// Task 1: Subscriptions Listing & Overview
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/subscriptions:
 *   get:
 *     summary: Retrieve subscription records with search, filtering, summary counts, and pagination
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getSubscriptionsController
);

// ──────────────────────────────────────────────
// Task 5: Subscription Reports & Audit History (declared before :id)
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/subscriptions/reports:
 *   get:
 *     summary: Generate subscription and billing reports
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/reports",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getSubscriptionReportsController
);

/**
 * @swagger
 * /api/v1/admin/subscriptions/audit-history:
 *   get:
 *     summary: Retrieve read-only audit log records for subscription and billing administrative actions
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/audit-history",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getSubscriptionAuditHistoryController
);

/**
 * @swagger
 * /api/v1/admin/subscriptions/failed-payments:
 *   get:
 *     summary: Retrieve failed subscription payments and payment retry attempts
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/failed-payments",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getFailedSubscriptionPaymentsController
);

// ──────────────────────────────────────────────
// Task 4: Plan Management
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/subscriptions/plans:
 *   get:
 *     summary: Retrieve all subscription plans with features and usage limits
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/plans",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getSubscriptionPlansController
);

/**
 * @swagger
 * /api/v1/admin/subscriptions/plans/{id}:
 *   get:
 *     summary: Retrieve details of a single subscription plan
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/plans/:id",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getSubscriptionPlanByIdController
);

/**
 * @swagger
 * /api/v1/admin/subscriptions/plans/{id}:
 *   put:
 *     summary: Update subscription plan details, pricing, features, and usage limits
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.put("/plans/:id",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  updateSubscriptionPlanController
);

// ──────────────────────────────────────────────
// Task 3: Subscription Issues Management
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/subscriptions/issues:
 *   get:
 *     summary: Retrieve subscription-related issues reported by users
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/issues",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getSubscriptionIssuesController
);

/**
 * @swagger
 * /api/v1/admin/subscriptions/issues:
 *   post:
 *     summary: Create a new subscription issue / complaint
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.post("/issues",
  createSubscriptionIssueController
);

/**
 * @swagger
 * /api/v1/admin/subscriptions/issues/{id}:
 *   get:
 *     summary: Retrieve subscription issue details, including user info, related subscription, payment history, and internal notes
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/issues/:id",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getSubscriptionIssueDetailsController
);

/**
 * @swagger
 * /api/v1/admin/subscriptions/issues/{id}/notes:
 *   post:
 *     summary: Add internal admin notes to a subscription issue
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.post("/issues/:id/notes",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  addSubscriptionIssueNoteController
);

/**
 * @swagger
 * /api/v1/admin/subscriptions/issues/{id}/status:
 *   patch:
 *     summary: Update subscription issue status (OPEN, UNDER_REVIEW, RESOLVED, CLOSED) and notify user
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.patch("/issues/:id/status",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_MANAGE),
  updateSubscriptionIssueStatusController
);

// ──────────────────────────────────────────────
// Task 2: Subscription Details & Billing History
// ──────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/admin/subscriptions/user/{userId}/billing:
 *   get:
 *     summary: Retrieve user billing history and payment receipts
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/user/:userId/billing",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getUserBillingHistoryController
);

/**
 * @swagger
 * /api/v1/admin/subscriptions/{id}:
 *   get:
 *     summary: Retrieve complete subscription details for a specific subscription
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getSubscriptionDetailsController
);

/**
 * @swagger
 * /api/v1/admin/subscriptions/{id}/activity:
 *   get:
 *     summary: Retrieve subscription activity history (upgrades, downgrades, cancellations, renewals)
 *     tags: [Admin Subscription Management]
 *     security:
 *       - bearerAuth: []
 */
router.get("/:id/activity",
  checkPermission(ADMIN_PERMISSIONS.SUBSCRIPTIONS_VIEW),
  getSubscriptionActivityController
);

module.exports = router;
