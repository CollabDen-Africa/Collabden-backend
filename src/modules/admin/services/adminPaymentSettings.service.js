const prisma = require("../../../config/prismaClient");
const { SETTINGS_CATEGORY_MAP } = require("../../../config/constants");
const {
  invalidatePlatformPaymentSettingsCache,
} = require("../../../services/platformSettings.service");

const PAYMENT_SETTING_FIELDS = [
  "transactionFeePercentage",
  "transactionFeeFixed",
  "minimumWithdrawalAmount",
  "maximumWithdrawalAmount",
  "supportedPaymentMethods",
  "currency",
];

const asNumber = (value) => Number(value);

// Never return a database object directly. This allow-list prevents future
// provider credential fields from accidentally becoming API output.
const toPublicPaymentSettings = (settings) => ({
  transactionFeePercentage: asNumber(settings.transactionFeePercentage),
  transactionFeeFixed: asNumber(settings.transactionFeeFixed),
  minimumWithdrawalAmount: asNumber(settings.minimumWithdrawalAmount),
  maximumWithdrawalAmount: asNumber(settings.maximumWithdrawalAmount),
  supportedPaymentMethods: settings.supportedPaymentMethods,
  currency: settings.currency,
  version: settings.version,
  updatedAt: settings.updatedAt,
});

const getPaymentSettings = async () => {
  let settings = await prisma.platformPaymentSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.platformPaymentSettings.create({
      data: { id: "singleton" },
    });
  }

  return toPublicPaymentSettings(settings);
};

const valuesDiffer = (previous, next) => {
  if (Array.isArray(previous) || Array.isArray(next)) {
    return JSON.stringify(previous) !== JSON.stringify(next);
  }
  return String(previous) !== String(next);
};

const formatAuditValue = (value) =>
  Array.isArray(value) ? JSON.stringify(value) : String(value ?? "");

const updatePaymentSettings = async (data, auditContext = {}) => {
  const { confirmation, ...requestedChanges } = data;
  const updateData = Object.fromEntries(
    Object.entries(requestedChanges).filter(([key]) => PAYMENT_SETTING_FIELDS.includes(key))
  );

  if (Object.keys(updateData).length === 0) {
    const error = new Error("No payment settings were provided to update.");
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    const currentSettings = await tx.platformPaymentSettings.findUnique({
      where: { id: "singleton" },
    });

    // The route is normally reached after GET has initialized the singleton.
    // Keeping creation here makes service usage safe in jobs and scripts too.
    const current =
      currentSettings ||
      (await tx.platformPaymentSettings.create({ data: { id: "singleton" } }));

    const nextMinimum =
      updateData.minimumWithdrawalAmount ?? asNumber(current.minimumWithdrawalAmount);
    const nextMaximum =
      updateData.maximumWithdrawalAmount ?? asNumber(current.maximumWithdrawalAmount);

    if (nextMinimum > nextMaximum) {
      const error = new Error(
        "maximumWithdrawalAmount must be greater than or equal to minimumWithdrawalAmount."
      );
      error.statusCode = 400;
      throw error;
    }

    // The version supplied in the confirmation makes the acknowledgement apply
    // to exactly the configuration the administrator reviewed.
    const updateResult = await tx.platformPaymentSettings.updateMany({
      where: { id: "singleton", version: confirmation.expectedVersion },
      data: {
        ...updateData,
        updatedBy: auditContext.performedBy || null,
        version: { increment: 1 },
      },
    });

    if (updateResult.count !== 1) {
      const error = new Error(
        "Payment settings changed after confirmation. Retrieve the latest settings and confirm again."
      );
      error.statusCode = 409;
      throw error;
    }

    const updatedSettings = await tx.platformPaymentSettings.findUnique({
      where: { id: "singleton" },
    });
    const changedFields = {};

    for (const key of Object.keys(updateData)) {
      if (valuesDiffer(current[key], updatedSettings[key])) {
        changedFields[key] = { old: current[key], new: updatedSettings[key] };
      }
    }

    if (Object.keys(changedFields).length > 0 && auditContext.performedBy) {
      await tx.adminAuditLog.create({
        data: {
          adminId: auditContext.performedBy,
          action: "PAYMENT_SETTINGS_UPDATED",
          details: {
            changes: changedFields,
            confirmedVersion: confirmation.expectedVersion,
          },
          ipAddress: auditContext.ipAddress || null,
          userAgent: auditContext.userAgent || null,
        },
      });

      for (const [key, { old: previousValue, new: newValue }] of Object.entries(changedFields)) {
        await tx.settingsAuditLog.create({
          data: {
            settingName: key,
            category: SETTINGS_CATEGORY_MAP[key] || "Payment Settings",
            previousValue: formatAuditValue(previousValue),
            newValue: formatAuditValue(newValue),
            adminId: auditContext.performedBy,
            ipAddress: auditContext.ipAddress || null,
            userAgent: auditContext.userAgent || null,
          },
        });
      }
    }

    return { settings: toPublicPaymentSettings(updatedSettings), changedFields };
  });

  invalidatePlatformPaymentSettingsCache();
  return result;
};

module.exports = {
  getPaymentSettings,
  updatePaymentSettings,
  toPublicPaymentSettings,
};
