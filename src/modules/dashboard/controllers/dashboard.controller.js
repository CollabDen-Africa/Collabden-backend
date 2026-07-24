const { 
  getUserDashboardData, 
  getAdminDashboardData: getAdminData,
  getUserActiveProjects: getActiveProjects,
  getUserNotifications: getNotifications,
  getAdminUserStats: getUserStats,
  getAdminProjectStats: getProjectStats,
  getAdminPendingStats: getPendingStats,
  getRecentActivities: getActivities,
  getPendingActions: getActions
} = require("../services/dashboard.service");

// Legacy monolithic user dashboard
const getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = await getUserDashboardData(userId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// User dashboard individual widgets
const getUserActiveProjects = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = await getActiveProjects(userId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = await getNotifications(userId);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Legacy monolithic admin dashboard
const getAdminDashboardData = async (req, res) => {
  try {
    const data = await getAdminData(req.user);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin dashboard individual widgets
const getAdminUserStats = async (req, res) => {
  try {
    const data = await getUserStats(req.user);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAdminProjectStats = async (req, res) => {
  try {
    const data = await getProjectStats(req.user);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAdminPendingStats = async (req, res) => {
  try {
    const data = await getPendingStats(req.user);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getRecentActivities = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const data = await getActivities(limit);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getPendingActions = async (req, res) => {
  try {
    const data = await getActions(req.user);
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDashboardData,
  getUserActiveProjects,
  getUserNotifications,
  getAdminDashboardData,
  getAdminUserStats,
  getAdminProjectStats,
  getAdminPendingStats,
  getRecentActivities,
  getPendingActions,
};
