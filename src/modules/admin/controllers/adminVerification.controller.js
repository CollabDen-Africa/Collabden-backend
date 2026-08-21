const verificationService = require("../services/adminVerification.service");

/**
 * Controller to list user verification requests with search, filtering, sorting, and pagination.
 * FR: FRA72, FRA73, FRA74 | NFR: NFRA45, NFRA50
 */
const getVerificationRequestsController = async (req, res) => {
  try {
    const result = await verificationService.getVerificationRequests(req.query);
    res.status(200).json({
      message: "Verification requests retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getVerificationRequestsController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to retrieve full verification request details including user profile, documents, and previous attempts.
 * FR: FRA75, FRA76 | NFR: NFRA46, NFRA47, NFRA49
 */
const getVerificationDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const details = await verificationService.getVerificationDetails(id);
    res.status(200).json({
      message: "Verification details retrieved successfully",
      data: details,
    });
  } catch (error) {
    console.error("Error in getVerificationDetailsController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to approve or reject a verification request.
 * FR: FRA77, FRA78, FRA79 | NFR: NFRA46, NFRA48, NFRA49
 */
const processVerificationDecisionController = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const result = await verificationService.processVerificationDecision(adminId, id, req.body);
    res.status(200).json({
      message: `Verification request ${req.body.status.toLowerCase()} successfully`,
      data: result,
    });
  } catch (error) {
    console.error("Error in processVerificationDecisionController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    if (
      error.message.includes("rejection reason is required") ||
      error.message.includes("Validation")
    ) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to retrieve complete verification history for a user.
 * FR: FRA80, FRA81 | NFR: NFRA48, NFRA49
 */
const getUserVerificationHistoryController = async (req, res) => {
  try {
    const { userId } = req.params;
    const history = await verificationService.getUserVerificationHistory(userId, req.query);
    res.status(200).json({
      message: "User verification history retrieved successfully",
      data: history,
    });
  } catch (error) {
    console.error("Error in getUserVerificationHistoryController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to retrieve verification audit history.
 * FR: FRA82 | NFR: NFRA48, NFRA49
 */
const getVerificationAuditHistoryController = async (req, res) => {
  try {
    const audit = await verificationService.getVerificationAuditHistory(req.query);
    res.status(200).json({
      message: "Verification audit history retrieved successfully",
      data: audit,
    });
  } catch (error) {
    console.error("Error in getVerificationAuditHistoryController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getVerificationRequestsController,
  getVerificationDetailsController,
  processVerificationDecisionController,
  getUserVerificationHistoryController,
  getVerificationAuditHistoryController,
};
