const { Router } = require("express");
const {
  getUserAccountSettingsController,
  updateUserAccountSettingsController,
  getSettingsAuditHistoryController,
  getGeneralPlatformSettingsController,
  updateGeneralPlatformSettingsController,
  getNotificationSettingsController,
  updateNotificationSettingsController,
  publishAnnouncementController,
  previewNotificationController,
  getMarketplaceSettingsController,
  updateMarketplaceSettingsController,
} = require("../controllers/adminSettings.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const {
  adminSettingsSchema,
  getSettingsAuditQuerySchema,
  generalSettingsSchema,
  notificationSettingsSchema,
  publishAnnouncementSchema,
  marketplaceSettingsSchema,
} = require("../../../schemas/adminSettings.schema");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

router.use(adminMiddleware());

/**
 * @swagger
 * /api/v1/admin/settings/users:
 *   get:
 *     summary: Retrieve current platform-wide user & account settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 */
router.get(
  "/users",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_VIEW),
  getUserAccountSettingsController
);

/**
 * @swagger
 * /api/v1/admin/settings/users:
 *   patch:
 *     summary: Update platform-wide user & account settings (partial update)
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phoneRequiredAtSignUp:
 *                 type: boolean
 *               maxFailedLoginsBeforeLock:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Settings updated successfully
 */
router.patch(
  "/users",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_MANAGE),
  validateRequest(adminSettingsSchema),
  updateUserAccountSettingsController
);

/**
 * @swagger
 * /api/v1/admin/settings/users/history:
 *   get:
 *     summary: Retrieve audit history for user & account settings updates
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: History retrieved successfully
 */
router.get(
  "/users/history",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_VIEW),
  validateRequest(getSettingsAuditQuerySchema),
  getSettingsAuditHistoryController
);

/**
 * @swagger
 * /api/v1/admin/settings/general:
 *   get:
 *     summary: Retrieve current general platform settings (branding, preferences, features)
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
 */
router.get(
  "/general",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_VIEW),
  getGeneralPlatformSettingsController
);

/**
 * @swagger
 * /api/v1/admin/settings/general:
 *   patch:
 *     summary: Update general platform settings (partial update)
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platformName:
 *                 type: string
 *               supportEmail:
 *                 type: string
 *               primaryColor:
 *                 type: string
 *                 description: Hex color code e.g. "#2563EB"
 *               logoUrl:
 *                 type: string
 *                 nullable: true
 *               defaultLanguage:
 *                 type: string
 *               defaultCurrency:
 *                 type: string
 *                 enum: [NGN, USD, GBP, EUR, KES, GHS]
 *               timezone:
 *                 type: string
 *               allowNewRegistrations:
 *                 type: boolean
 *               maintenanceMode:
 *                 type: boolean
 *               enableMarketplace:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *       400:
 *         description: Validation error
 */
router.patch(
  "/general",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_MANAGE),
  validateRequest(generalSettingsSchema),
  updateGeneralPlatformSettingsController
);

/**
 * @swagger
 * /api/v1/admin/settings/notifications:
 *   get:
 *     summary: Retrieve current notification settings (email, in-app, announcements)
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
 */
router.get(
  "/notifications",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_VIEW),
  getNotificationSettingsController
);

/**
 * @swagger
 * /api/v1/admin/settings/notifications:
 *   patch:
 *     summary: Update notification settings (partial update)
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailNotificationsEnabled:
 *                 type: boolean
 *               emailSenderName:
 *                 type: string
 *               emailSenderAddress:
 *                 type: string
 *               emailFooterText:
 *                 type: string
 *                 nullable: true
 *               notifyOnNewRegistration:
 *                 type: boolean
 *               notifyOnProjectInvite:
 *                 type: boolean
 *               notifyOnPaymentReceived:
 *                 type: boolean
 *               notifyOnAccountFlagged:
 *                 type: boolean
 *               inAppNotificationsEnabled:
 *                 type: boolean
 *               notifyOnNewMessage:
 *                 type: boolean
 *               notifyOnConnectionRequest:
 *                 type: boolean
 *               notifyOnProjectUpdate:
 *                 type: boolean
 *               notifyOnMilestoneCompleted:
 *                 type: boolean
 *               systemAnnouncementsEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
 *       400:
 *         description: Validation error
 */
router.patch(
  "/notifications",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_MANAGE),
  validateRequest(notificationSettingsSchema),
  updateNotificationSettingsController
);

/**
 * @swagger
 * /api/v1/admin/settings/notifications/announcement:
 *   post:
 *     summary: Publish a system-wide announcement banner
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               body:
 *                 type: string
 *                 maxLength: 2000
 *               type:
 *                 type: string
 *                 enum: [info, warning, critical]
 *                 default: info
 *     responses:
 *       200:
 *         description: Announcement published
 *       409:
 *         description: System announcements are disabled
 */
router.post(
  "/notifications/announcement",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_MANAGE),
  validateRequest(publishAnnouncementSchema),
  publishAnnouncementController
);

/**
 * @swagger
 * /api/v1/admin/settings/notifications/preview:
 *   post:
 *     summary: Preview a notification template with variable interpolation (no DB write)
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, templateKey]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, in-app, announcement]
 *               templateKey:
 *                 type: string
 *                 description: e.g. notifyOnPaymentReceived
 *               variables:
 *                 type: object
 *                 description: Key-value pairs for {{placeholder}} substitution
 *     responses:
 *       200:
 *         description: Rendered preview payload (no notification sent)
 */
router.post(
  "/notifications/preview",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_VIEW),
  previewNotificationController
);

/**
 * @swagger
 * /api/v1/admin/settings/marketplace:
 *   get:
 *     summary: Retrieve current marketplace settings
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Marketplace settings retrieved successfully
 */
router.get(
  "/marketplace",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_VIEW),
  getMarketplaceSettingsController
);

/**
 * @swagger
 * /api/v1/admin/settings/marketplace:
 *   patch:
 *     summary: Update marketplace settings (partial update)
 *     tags: [Admin Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               listingApprovalRequired:
 *                 type: boolean
 *               allowGuestBrowsing:
 *                 type: boolean
 *               allowBuyerRegistrations:
 *                 type: boolean
 *               allowSellerRegistrations:
 *                 type: boolean
 *               maxActiveListingsPerUser:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *               requireProjectBudget:
 *                 type: boolean
 *               requireProjectDeadline:
 *                 type: boolean
 *               allowFixedPriceProjects:
 *                 type: boolean
 *               allowHourlyProjects:
 *                 type: boolean
 *               minimumProjectBudget:
 *                 type: integer
 *                 minimum: 0
 *               projectPostingCooldownHours:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 168
 *               defaultCollaboratorVisibility:
 *                 type: string
 *                 enum: [all, verified, connections]
 *               showCollaboratorRatings:
 *                 type: boolean
 *               showCollaboratorReviews:
 *                 type: boolean
 *               allowCollaboratorsToHideEarnings:
 *                 type: boolean
 *               searchEnabled:
 *                 type: boolean
 *               featuredListingsEnabled:
 *                 type: boolean
 *               allowSponsoredListings:
 *                 type: boolean
 *               searchResultsPerPage:
 *                 type: integer
 *                 minimum: 5
 *                 maximum: 100
 *               enableLocationBasedSearch:
 *                 type: boolean
 *               enableSkillBasedSearch:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Marketplace settings updated. May include a warning for significant changes.
 *       400:
 *         description: Validation error
 */
router.patch(
  "/marketplace",
  checkPermission(ADMIN_PERMISSIONS.SETTINGS_MANAGE),
  validateRequest(marketplaceSettingsSchema),
  updateMarketplaceSettingsController
);

module.exports = router;
