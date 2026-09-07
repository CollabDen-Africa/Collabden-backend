const { z } = require("zod");

const adminSettingsSchema = z.object({
  // Account Registration Requirements
  phoneRequiredAtSignUp: z.boolean().optional(),
  dobRequired: z.boolean().optional(),
  stageNameRequired: z.boolean().optional(),
  agreeToTermsRequired: z.boolean().optional(),
  ageVerificationRequired: z.boolean().optional(),

  // Profile Visibility Rules
  defaultProfileVisibility: z.enum(["Public", "Private", "Connections Only"]).optional(),
  contactInfoVisibility: z.enum(["Hidden", "Connections Only", "Public"]).optional(),
  allowUsersToSetPrivate: z.boolean().optional(),
  showOnlineStatus: z.boolean().optional(),
  allowSeeEachOthersConnections: z.boolean().optional(),

  // Verification Requirements
  verificationToSellOnMarketplace: z.boolean().optional(),
  verificationToWithdrawEarnings: z.boolean().optional(),
  verificationToEnterEscrow: z.boolean().optional(),
  showVerifiedBadge: z.boolean().optional(),

  // Account Restriction Settings
  maxFailedLoginsBeforeLock: z.union([z.number(), z.string().transform(Number)])
    .refine((val) => [3, 5, 10].includes(val), {
      message: "maxFailedLoginsBeforeLock must be 3, 5, or 10",
    }).optional(),
  accountLockDuration: z.enum(["15", "30", "60", "1440"]).optional(),
  allowAdminsToSuspend: z.boolean().optional(),
  autoFlagUnusualActivity: z.boolean().optional(),
});

const getSettingsAuditQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  search: z.string().optional(),
  category: z.string().optional(),
  settingName: z.string().optional(),
  adminId: z.string().optional(),
  dateFrom: z.string().optional().transform(val => val ? new Date(val) : undefined),
  dateTo: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

const generalSettingsSchema = z.object({
  // Platform Branding
  platformName: z.string().min(1).max(100).optional(),
  supportEmail: z.string().email({ message: "Invalid support email address." }).optional(),
  primaryColor: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, { message: "primaryColor must be a valid hex color (e.g. #2563EB)." })
    .optional(),
  logoUrl: z.string().url({ message: "logoUrl must be a valid URL." }).optional().nullable(),

  // Platform Preferences
  defaultLanguage: z.string().min(2).max(10).optional(),
  defaultCurrency: z.enum(["NGN", "USD", "GBP", "EUR", "KES", "GHS"]).optional(),
  timezone: z.string().min(1).optional(),

  // General Features
  allowNewRegistrations: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  enableMarketplace: z.boolean().optional(),
});

const notificationSettingsSchema = z.object({
  // Email Notifications
  emailNotificationsEnabled:  z.boolean().optional(),
  emailSenderName:            z.string().min(1).max(100).optional(),
  emailSenderAddress:         z.string().email({ message: "Invalid sender email." }).optional(),
  emailFooterText:            z.string().max(500).optional().nullable(),

  // Email event toggles
  notifyOnNewRegistration:    z.boolean().optional(),
  notifyOnProjectInvite:      z.boolean().optional(),
  notifyOnPaymentReceived:    z.boolean().optional(),
  notifyOnAccountFlagged:     z.boolean().optional(),

  // In-App Notifications
  inAppNotificationsEnabled:  z.boolean().optional(),
  notifyOnNewMessage:         z.boolean().optional(),
  notifyOnConnectionRequest:  z.boolean().optional(),
  notifyOnProjectUpdate:      z.boolean().optional(),
  notifyOnMilestoneCompleted: z.boolean().optional(),

  // System Announcements master toggle
  systemAnnouncementsEnabled: z.boolean().optional(),

  // Allow clearing the active announcement via PATCH
  activeAnnouncementTitle:    z.string().max(200).optional().nullable(),
  activeAnnouncementBody:     z.string().max(2000).optional().nullable(),
  activeAnnouncementType:     z.enum(["info", "warning", "critical"]).optional(),
});

const publishAnnouncementSchema = z.object({
  title:   z.string().min(1, "Title is required.").max(200),
  body:    z.string().min(1, "Body is required.").max(2000),
  type:    z.enum(["info", "warning", "critical"]).default("info"),
});

const marketplaceSettingsSchema = z.object({
  // Marketplace Availability
  listingApprovalRequired:  z.boolean().optional(),
  allowGuestBrowsing:       z.boolean().optional(),
  allowBuyerRegistrations:  z.boolean().optional(),
  allowSellerRegistrations: z.boolean().optional(),

  // Project Posting Rules
  maxActiveListingsPerUser:    z.number().int().min(1).max(100).optional(),
  requireProjectBudget:        z.boolean().optional(),
  requireProjectDeadline:      z.boolean().optional(),
  allowFixedPriceProjects:     z.boolean().optional(),
  allowHourlyProjects:         z.boolean().optional(),
  minimumProjectBudget:        z.number().int().min(0).optional(),
  projectPostingCooldownHours: z.number().int().min(0).max(168).optional(), // max 1 week

  // Collaboration Visibility
  defaultCollaboratorVisibility:    z.enum(["all", "verified", "connections"]).optional(),
  showCollaboratorRatings:          z.boolean().optional(),
  showCollaboratorReviews:          z.boolean().optional(),
  allowCollaboratorsToHideEarnings: z.boolean().optional(),

  // Search & Discovery
  searchEnabled:             z.boolean().optional(),
  featuredListingsEnabled:   z.boolean().optional(),
  allowSponsoredListings:    z.boolean().optional(),
  searchResultsPerPage:      z.number().int().min(5).max(100).optional(),
  enableLocationBasedSearch: z.boolean().optional(),
  enableSkillBasedSearch:    z.boolean().optional(),
});

const paymentMethodSchema = z.enum(["CARD", "BANK_TRANSFER", "USSD"]);

const paymentSettingsSchema = z
  .object({
    transactionFeePercentage: z.number().min(0).max(100).optional(),
    transactionFeeFixed: z.number().min(0).max(1000000).optional(),
    minimumWithdrawalAmount: z.number().positive().max(100000000).optional(),
    maximumWithdrawalAmount: z.number().positive().max(100000000).optional(),
    supportedPaymentMethods: z
      .array(paymentMethodSchema)
      .min(1, "At least one payment method must be supported.")
      .max(3)
      .refine((methods) => new Set(methods).size === methods.length, {
        message: "Supported payment methods must not contain duplicates.",
      })
      .optional(),
    currency: z.literal("NGN").optional(),
    confirmation: z.object({
      confirmed: z.literal(true, {
        error: "Financial configuration changes require explicit confirmation.",
      }),
      expectedVersion: z.number().int().positive(),
    }),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.minimumWithdrawalAmount !== undefined &&
      data.maximumWithdrawalAmount !== undefined &&
      data.minimumWithdrawalAmount > data.maximumWithdrawalAmount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maximumWithdrawalAmount"],
        message: "maximumWithdrawalAmount must be greater than or equal to minimumWithdrawalAmount.",
      });
    }
  });

module.exports = {
  adminSettingsSchema,
  getSettingsAuditQuerySchema,
  generalSettingsSchema,
  notificationSettingsSchema,
  publishAnnouncementSchema,
  marketplaceSettingsSchema,
  paymentSettingsSchema,
};
