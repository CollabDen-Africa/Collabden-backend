const prisma = require("../../../config/prismaClient");
const { SETTINGS_CATEGORY_MAP } = require("../../../config/constants");
const {
  invalidatePlatformUserSettingsCache,
  invalidatePlatformGeneralSettingsCache,
  invalidatePlatformMarketplaceSettingsCache,
} = require("../../../services/platformSettings.service");

/**
 * Get current platform settings
 */
const getUserAccountSettings = async () => {
  let settings = await prisma.platformUserSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformUserSettings.create({
      data: { id: "singleton" },
    });
  }

  return settings;
};

/**
 * Update platform settings and log audit trail
 */
const updateUserAccountSettings = async (data, auditContext = {}) => {
  const currentSettings = await getUserAccountSettings();

  const result = await prisma.$transaction(async (tx) => {
    const updatedSettings = await tx.platformUserSettings.update({
      where: { id: "singleton" },
      data: {
        ...data,
        updatedBy: auditContext.performedBy || null,
      },
    });

    // Determine what changed for the audit log
    const changedFields = {};
    for (const key of Object.keys(data)) {
      if (currentSettings[key] !== updatedSettings[key]) {
        changedFields[key] = {
          old: currentSettings[key],
          new: updatedSettings[key],
        };
      }
    }

    if (Object.keys(changedFields).length > 0 && auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "USER_SETTINGS_UPDATED",
          details: changedFields,
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null,
        },
      });

      for (const [key, { old: previousValue, new: newValue }] of Object.entries(changedFields)) {
        await tx.settingsAuditLog.create({
          data: {
            settingName: key,
            category: SETTINGS_CATEGORY_MAP[key] || "General",
            previousValue: String(previousValue ?? ""),
            newValue: String(newValue ?? ""),
            adminId: auditContext.performedBy,
            ipAddress: auditContext.ipAddress || null,
            userAgent: auditContext.userAgent || null,
          },
        });
      }
    }

    return updatedSettings;
  });

  // Check for significant changes (restriction settings)
  const restrictionKeys = [
    "maxFailedLoginsBeforeLock",
    "accountLockDuration",
    "allowAdminsToSuspend",
    "autoFlagUnusualActivity",
  ];

  const significantChanges = Object.keys(data).filter((key) =>
    restrictionKeys.includes(key) && currentSettings[key] !== data[key]
  );

  // Invalidate the in-process cache so the next login/signup picks up fresh values
  invalidatePlatformUserSettingsCache();

  return {
    settings: result,
    significantChanges,
  };
};


const getSettingsAuditHistory = async (query = {}) => {
  const { page = 1, limit = 20, search, category, settingName, adminId, dateFrom, dateTo } = query;
  const skip = (page - 1) * limit;

  const where = {};

  if (category) {
    where.category = category;
  }
  
  if (settingName) {
    where.settingName = settingName;
  }

  if (adminId) {
    where.adminId = adminId;
  }

  if (dateFrom || dateTo) {
    where.performedAt = {};
    if (dateFrom) where.performedAt.gte = new Date(dateFrom);
    if (dateTo) where.performedAt.lte = new Date(dateTo);
  }

  if (search) {
    where.OR = [
      {
        admin: {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        settingName: {
          contains: search,
          mode: "insensitive",
        }
      }
    ];
  }

  const [total, logs] = await Promise.all([
    prisma.settingsAuditLog.count({ where }),
    prisma.settingsAuditLog.findMany({
      where,
      skip: Number(skip),
      take: Number(limit),
      orderBy: { performedAt: "desc" },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return {
    logs,
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / limit),
  };
};


/**
 * Get current general platform settings
 */
const getGeneralPlatformSettings = async () => {
  let settings = await prisma.platformGeneralSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformGeneralSettings.create({
      data: { id: "singleton" },
    });
  }

  return settings;
};

/**
 * Update general platform settings and log audit trail
 */
const updateGeneralPlatformSettings = async (data, auditContext = {}) => {
  const currentSettings = await getGeneralPlatformSettings();

  const result = await prisma.$transaction(async (tx) => {
    const updatedSettings = await tx.platformGeneralSettings.update({
      where: { id: "singleton" },
      data: {
        ...data,
        updatedBy: auditContext.performedBy || null,
      },
    });

    const changedFields = {};
    for (const key of Object.keys(data)) {
      if (String(currentSettings[key]) !== String(updatedSettings[key])) {
        changedFields[key] = {
          old: currentSettings[key],
          new: updatedSettings[key],
        };
      }
    }

    if (Object.keys(changedFields).length > 0 && auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "GENERAL_SETTINGS_UPDATED",
          details: changedFields,
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null,
        },
      });

      for (const [key, { old: previousValue, new: newValue }] of Object.entries(changedFields)) {
        await tx.settingsAuditLog.create({
          data: {
            settingName: key,
            category: SETTINGS_CATEGORY_MAP[key] || "General",
            previousValue: String(previousValue ?? ""),
            newValue: String(newValue ?? ""),
            adminId: auditContext.performedBy,
            ipAddress: auditContext.ipAddress || null,
            userAgent: auditContext.userAgent || null,
          },
        });
      }
    }

    return updatedSettings;
  });

  const significantKeys = ["maintenanceMode", "allowNewRegistrations"];
  const significantChanges = Object.keys(data).filter(
    (key) => significantKeys.includes(key) && currentSettings[key] !== data[key]
  );

  invalidatePlatformGeneralSettingsCache();

  return {
    settings: result,
    significantChanges,
  };
};


/**
 * Get current notification settings (singleton, auto-created on first access)
 */
const getNotificationSettings = async () => {
  let settings = await prisma.platformNotificationSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformNotificationSettings.create({
      data: { id: "singleton" },
    });
  }

  return settings;
};

/**
 * Partial-update notification settings and write per-field audit log entries
 */
const updateNotificationSettings = async (data, auditContext = {}) => {
  const currentSettings = await getNotificationSettings();

  const result = await prisma.$transaction(async (tx) => {
    const updatedSettings = await tx.platformNotificationSettings.update({
      where: { id: "singleton" },
      data: {
        ...data,
        updatedBy: auditContext.performedBy || null,
      },
    });

    const changedFields = {};
    for (const key of Object.keys(data)) {
      if (String(currentSettings[key]) !== String(updatedSettings[key])) {
        changedFields[key] = { old: currentSettings[key], new: updatedSettings[key] };
      }
    }

    if (Object.keys(changedFields).length > 0 && auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "NOTIFICATION_SETTINGS_UPDATED",
          details: changedFields,
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null,
        },
      });

      for (const [key, { old: previousValue, new: newValue }] of Object.entries(changedFields)) {
        await tx.settingsAuditLog.create({
          data: {
            settingName: key,
            category: SETTINGS_CATEGORY_MAP[key] || "Notification Settings",
            previousValue: String(previousValue ?? ""),
            newValue: String(newValue ?? ""),
            adminId: auditContext.performedBy,
            ipAddress: auditContext.ipAddress || null,
            userAgent: auditContext.userAgent || null,
          },
        });
      }
    }

    return updatedSettings;
  });

  return { settings: result };
};


const publishAnnouncement = async ({ title, body, type }, auditContext = {}) => {
  const currentSettings = await getNotificationSettings();

  if (!currentSettings.systemAnnouncementsEnabled) {
    throw new Error("System announcements are currently disabled. Enable them before publishing.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedSettings = await tx.platformNotificationSettings.update({
      where: { id: "singleton" },
      data: {
        activeAnnouncementTitle:  title,
        activeAnnouncementBody:   body,
        activeAnnouncementType:   type,
        announcementPublishedAt:  new Date(),
        announcementPublishedBy:  auditContext.performedBy || null,
        updatedBy: auditContext.performedBy || null,
      },
    });

    if (auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "ANNOUNCEMENT_PUBLISHED",
          details: { title, type },
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null,
        },
      });

      await tx.settingsAuditLog.create({
        data: {
          settingName: "activeAnnouncementBody",
          category: "System Announcements",
          previousValue: currentSettings.activeAnnouncementBody || "",
          newValue: body,
          adminId: auditContext.performedBy,
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null,
        },
      });
    }

    return updatedSettings;
  });

  return {
    message: "Announcement published successfully.",
    announcement: {
      title:       result.activeAnnouncementTitle,
      body:        result.activeAnnouncementBody,
      type:        result.activeAnnouncementType,
      publishedAt: result.announcementPublishedAt,
    },
  };
};


const previewNotification = (data) => {
  const { type, templateKey, variables = {} } = data;

  const TEMPLATE_DEFAULTS = {
    // Email templates
    notifyOnNewRegistration:  { subject: "Welcome to {{platformName}}!", body: "Hi {{userName}}, your account has been created." },
    notifyOnProjectInvite:    { subject: "You've been invited to a project", body: "Hi {{userName}}, {{inviterName}} has invited you to collaborate on {{projectName}}." },
    notifyOnPaymentReceived:  { subject: "Payment of {{amount}} received", body: "Hi {{userName}}, you've received a payment of {{amount}} for {{projectName}}." },
    notifyOnAccountFlagged:   { subject: "Account Notice", body: "Hi {{userName}}, your account has been flagged for review. Reason: {{reason}}." },
    // In-app templates
    notifyOnNewMessage:        { title: "New Message", body: "{{senderName}} sent you a message." },
    notifyOnConnectionRequest: { title: "Connection Request", body: "{{senderName}} wants to connect with you." },
    notifyOnProjectUpdate:     { title: "Project Updated", body: "{{projectName}} has been updated." },
    notifyOnMilestoneCompleted:{ title: "Milestone Completed", body: "Milestone '{{milestoneName}}' in {{projectName}} is complete." },
    // Announcement template
    announcement: { title: "{{announcementTitle}}", body: "{{announcementBody}}" },
  };

  const template = TEMPLATE_DEFAULTS[templateKey] || TEMPLATE_DEFAULTS["announcement"];

  const interpolate = (str) =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);

  const rendered = {};
  for (const [k, v] of Object.entries(template)) {
    rendered[k] = interpolate(v);
  }

  return {
    channel: type,
    templateKey,
    preview: rendered,
    variables,
    note: "This is a preview only. No email or notification was sent.",
  };
};



const getMarketplaceSettings = async () => {
  let settings = await prisma.platformMarketplaceSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformMarketplaceSettings.create({
      data: { id: "singleton" },
    });
  }

  return settings;
};


const updateMarketplaceSettings = async (data, auditContext = {}) => {
  const currentSettings = await getMarketplaceSettings();

  const result = await prisma.$transaction(async (tx) => {
    const updatedSettings = await tx.platformMarketplaceSettings.update({
      where: { id: "singleton" },
      data: {
        ...data,
        updatedBy: auditContext.performedBy || null,
      },
    });

    const changedFields = {};
    for (const key of Object.keys(data)) {
      if (String(currentSettings[key]) !== String(updatedSettings[key])) {
        changedFields[key] = { old: currentSettings[key], new: updatedSettings[key] };
      }
    }

    if (Object.keys(changedFields).length > 0 && auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "MARKETPLACE_SETTINGS_UPDATED",
          details: changedFields,
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null,
        },
      });

      for (const [key, { old: previousValue, new: newValue }] of Object.entries(changedFields)) {
        await tx.settingsAuditLog.create({
          data: {
            settingName: key,
            category: SETTINGS_CATEGORY_MAP[key] || "Marketplace Settings",
            previousValue: String(previousValue ?? ""),
            newValue: String(newValue ?? ""),
            adminId: auditContext.performedBy,
            ipAddress: auditContext.ipAddress || null,
            userAgent: auditContext.userAgent || null,
          },
        });
      }
    }

    return updatedSettings;
  });

  const significantKeys = [
    "allowBuyerRegistrations",
    "allowSellerRegistrations",
    "listingApprovalRequired",
    "searchEnabled",
  ];
  const significantChanges = Object.keys(data).filter(
    (key) => significantKeys.includes(key) && currentSettings[key] !== data[key]
  );
  invalidatePlatformMarketplaceSettingsCache();

  return { settings: result, significantChanges };
};

module.exports = {
  getUserAccountSettings,
  updateUserAccountSettings,
  getGeneralPlatformSettings,
  updateGeneralPlatformSettings,
  getNotificationSettings,
  updateNotificationSettings,
  publishAnnouncement,
  previewNotification,
  getMarketplaceSettings,
  updateMarketplaceSettings,
  getSettingsAuditHistory,
};
