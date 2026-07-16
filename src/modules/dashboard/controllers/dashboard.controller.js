const { getUserDashboardData, getAdminDashboardData: getAdminData } = require("../services/dashboard.service");

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

const getAdminDashboardData = async (req, res) => {
  try {
    const data = await getAdminData();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getDashboardData,
  getAdminDashboardData,
};
