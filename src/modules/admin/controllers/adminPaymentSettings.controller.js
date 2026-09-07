const {
  getPaymentSettings,
  updatePaymentSettings,
} = require("../services/adminPaymentSettings.service");

const buildAuditContext = (req) => ({
  performedBy: req.user.id,
  ipAddress: req.ip || req.connection?.remoteAddress,
  userAgent: req.headers["user-agent"],
});

const getPaymentSettingsController = async (req, res) => {
  try {
    const settings = await getPaymentSettings();
    return res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching payment settings:", error);
    return res.status(500).json({ error: "Failed to fetch payment settings." });
  }
};

const updatePaymentSettingsController = async (req, res) => {
  try {
    const { settings, changedFields } = await updatePaymentSettings(
      req.body,
      buildAuditContext(req)
    );

    return res.status(200).json({
      message: "Payment settings updated successfully.",
      settings,
      changedFields: Object.keys(changedFields),
    });
  } catch (error) {
    console.error("Error updating payment settings:", error);
    return res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : "Failed to update payment settings.",
    });
  }
};

module.exports = {
  getPaymentSettingsController,
  updatePaymentSettingsController,
};
