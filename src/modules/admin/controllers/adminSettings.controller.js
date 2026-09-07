const {
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
} = require("../services/adminSettings.service");

/**
 * Helper to build the standard audit context from a request.
 */
const buildAuditContext = (req) => ({
  performedBy: req.user.id,
  ipAddress: req.ip || req.connection?.remoteAddress,
  userAgent: req.headers["user-agent"],
});

const getUserAccountSettingsController = async (req, res) => {
  try {
    const settings = await getUserAccountSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching user account settings:", error);
    res.status(500).json({ error: "Failed to fetch settings." });
  }
};

const updateUserAccountSettingsController = async (req, res) => {
  try {
    const data = req.body;
    
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No data provided to update." });
    }

    const { settings, significantChanges } = await updateUserAccountSettings(
      data,
      buildAuditContext(req)
    );

    const response = {
      message: "Settings updated successfully.",
      settings,
      significantChanges,
    };

    if (significantChanges.length > 0) {
      response.warning = "Some changes affect account restriction behavior platform-wide. Review carefully before saving.";
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error updating user account settings:", error);
    res.status(500).json({ error: "Failed to update settings." });
  }
};

const getSettingsAuditHistoryController = async (req, res) => {
  try {
    const result = await getSettingsAuditHistory(req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching settings audit history:", error);
    res.status(500).json({ error: "Failed to fetch audit history." });
  }
};

const getGeneralPlatformSettingsController = async (req, res) => {
  try {
    const settings = await getGeneralPlatformSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching general platform settings:", error);
    res.status(500).json({ error: "Failed to fetch settings." });
  }
};

const updateGeneralPlatformSettingsController = async (req, res) => {
  try {
    const data = req.body;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No data provided to update." });
    }

    const { settings, significantChanges } = await updateGeneralPlatformSettings(
      data,
      buildAuditContext(req)
    );

    const response = {
      message: "General settings updated successfully.",
      settings,
      significantChanges,
    };

    if (significantChanges.includes("maintenanceMode") && settings.maintenanceMode) {
      response.warning = "Maintenance mode is now ENABLED. All users will be shown a maintenance page.";
    } else if (significantChanges.includes("allowNewRegistrations") && !settings.allowNewRegistrations) {
      response.warning = "New user registrations are now DISABLED. Existing users are unaffected.";
    } else if (significantChanges.length > 0) {
      response.warning = "Some changes have platform-wide impact. Verify before proceeding.";
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error updating general platform settings:", error);
    res.status(500).json({ error: "Failed to update settings." });
  }
};

const getNotificationSettingsController = async (req, res) => {
  try {
    const settings = await getNotificationSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching notification settings:", error);
    res.status(500).json({ error: "Failed to fetch notification settings." });
  }
};

const updateNotificationSettingsController = async (req, res) => {
  try {
    const data = req.body;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No data provided to update." });
    }
    const { settings } = await updateNotificationSettings(data, buildAuditContext(req));
    res.status(200).json({ message: "Notification settings updated successfully.", settings });
  } catch (error) {
    console.error("Error updating notification settings:", error);
    res.status(500).json({ error: "Failed to update notification settings." });
  }
};

const publishAnnouncementController = async (req, res) => {
  try {
    const { title, body, type } = req.body;
    const result = await publishAnnouncement({ title, body, type }, buildAuditContext(req));
    res.status(200).json(result);
  } catch (error) {
    console.error("Error publishing announcement:", error);
    // Surface domain errors (e.g. announcements disabled) as 409
    if (error.message?.includes("disabled")) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: "Failed to publish announcement." });
  }
};

const previewNotificationController = (req, res) => {
  try {
    const result = previewNotification(req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error generating notification preview:", error);
    res.status(500).json({ error: "Failed to generate preview." });
  }
};

const getMarketplaceSettingsController = async (req, res) => {
  try {
    const settings = await getMarketplaceSettings();
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching marketplace settings:", error);
    res.status(500).json({ error: "Failed to fetch marketplace settings." });
  }
};

const updateMarketplaceSettingsController = async (req, res) => {
  try {
    const data = req.body;
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No data provided to update." });
    }

    const { settings, significantChanges } = await updateMarketplaceSettings(
      data,
      buildAuditContext(req)
    );

    const response = {
      message: "Marketplace settings updated successfully.",
      settings,
      significantChanges,
    };

    if (significantChanges.includes("allowBuyerRegistrations") && !settings.allowBuyerRegistrations) {
      response.warning = "Buyer registrations are now DISABLED. New users cannot register as buyers.";
    } else if (significantChanges.includes("allowSellerRegistrations") && !settings.allowSellerRegistrations) {
      response.warning = "Seller registrations are now DISABLED. New users cannot register as sellers.";
    } else if (significantChanges.includes("searchEnabled") && !settings.searchEnabled) {
      response.warning = "Marketplace search is now DISABLED. Users cannot discover listings via search.";
    } else if (significantChanges.length > 0) {
      response.warning = "Some changes have platform-wide marketplace impact. Verify before proceeding.";
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("Error updating marketplace settings:", error);
    res.status(500).json({ error: "Failed to update marketplace settings." });
  }
};

module.exports = {
  getUserAccountSettingsController,
  updateUserAccountSettingsController,
  getGeneralPlatformSettingsController,
  updateGeneralPlatformSettingsController,
  getNotificationSettingsController,
  updateNotificationSettingsController,
  publishAnnouncementController,
  previewNotificationController,
  getMarketplaceSettingsController,
  updateMarketplaceSettingsController,
  getSettingsAuditHistoryController,
};
