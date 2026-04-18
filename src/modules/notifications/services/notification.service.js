const prisma = require("../../../config/prismaClient");

/**
 * Create a notification record in the database.
 */
const createNotification = async ({ userId, title, message, type, link }) => {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      link,
    },
  });
  return notification;
};

/**
 * Get all notifications for a user, ordered by most recent first.
 */
const getUserNotifications = async (userId) => {
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return notifications;
};

/**
 * Mark a single notification as read.
 */
const markAsRead = async (notificationId) => {
  const notification = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
  return notification;
};

/**
 * Mark all notifications for a user as read.
 */
const markAllAsRead = async (userId) => {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
};
