const {
  generatePaymentReport,
  getPaymentAuditHistory,
} = require("../services/adminPaymentReports.service");

const generatePaymentReportController = async (req, res) => {
  try {
    const {
      dateStart,
      dateEnd,
      type,
      status,
      page,
      limit,
    } = req.query;

    const filters = {
      dateStart,
      dateEnd,
      type,
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const report = await generatePaymentReport(filters);
    res.status(200).json(report);
  } catch (error) {
    console.error("Error in generatePaymentReportController:", error);
    res.status(500).json({ error: error.message || "Failed to generate payment report" });
  }
};

const getPaymentAuditHistoryController = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      adminId,
      dateStart,
      dateEnd,
    } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      adminId,
      dateStart,
      dateEnd,
    };

    const auditLogs = await getPaymentAuditHistory(filters);
    res.status(200).json(auditLogs);
  } catch (error) {
    console.error("Error in getPaymentAuditHistoryController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch payment audit history" });
  }
};

module.exports = {
  generatePaymentReportController,
  getPaymentAuditHistoryController,
};
