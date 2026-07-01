const prisma = require("../../../config/prismaClient");

/**
 * Fetch or create default notification settings for a user.
 */
const getSettings = async (userId) => {
  let settings = await prisma.notificationSetting.findUnique({
    where: { userId },
  });

  // If settings don't exist yet, create default settings
  if (!settings) {
    settings = await prisma.notificationSetting.create({
      data: { userId },
    });
  }

  return settings;
};

/**
 * Update notification settings for a user.
 */
const updateSettings = async (userId, updateData) => {
  // Ensure settings exist first
  await getSettings(userId);

  const updatedSettings = await prisma.notificationSetting.update({
    where: { userId },
    data: updateData,
  });

  return updatedSettings;
};

/**
 * Utility to verify if a notification should be sent via a specific channel.
 * Channels: "inApp", "email", "sms"
 */
const shouldSend = async (userId, channel) => {
  const settings = await getSettings(userId);
  return settings[channel] === true;
};

module.exports = {
  getSettings,
  updateSettings,
  shouldSend,
};
