const { getSettings, updateSettings } = require("../services/notificationSetting.service");

/**
 * Get notification settings for the authenticated user.
 */
const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await getSettings(userId);
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error in getNotificationSettings:", error);
    res.status(500).json({ success: false, error: "Failed to fetch notification settings." });
  }
};

/**
 * Update notification settings for the authenticated user.
 */
const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { inApp, email, sms, frequency } = req.body;

    // Filter out undefined values to only update provided fields
    const updateData = {};
    if (inApp !== undefined) updateData.inApp = inApp;
    if (email !== undefined) updateData.email = email;
    if (sms !== undefined) updateData.sms = sms;
    if (frequency !== undefined) updateData.frequency = frequency;

    const settings = await updateSettings(userId, updateData);
    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error in updateNotificationSettings:", error);
    res.status(500).json({ success: false, error: "Failed to update notification settings." });
  }
};

module.exports = {
  getNotificationSettings,
  updateNotificationSettings,
};
