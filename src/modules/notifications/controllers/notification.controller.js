const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
} = require("../services/notification.service");

const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await getUserNotifications(userId);
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await markAsRead(id);
    res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await markAllAsRead(userId);
    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
