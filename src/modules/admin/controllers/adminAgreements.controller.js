const agreementService = require("../services/adminAgreements.service");

/**
 * Controller to list all legal agreements with search, filter, and pagination.
 */
const getAgreementsController = async (req, res) => {
  try {
    const result = await agreementService.getAgreements(req.query);
    res.status(200).json({
      message: "Legal agreements retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getAgreementsController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to get agreement details with signatories and signed document access.
 */
const getAgreementDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const agreement = await agreementService.getAgreementDetails(id);
    res.status(200).json({
      message: "Agreement details retrieved successfully",
      data: agreement,
    });
  } catch (error) {
    console.error("Error in getAgreementDetailsController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to get agreement activity history.
 */
const getAgreementActivityController = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await agreementService.getAgreementActivity(id);
    res.status(200).json({
      message: "Agreement activity history retrieved successfully",
      data: activity,
    });
  } catch (error) {
    console.error("Error in getAgreementActivityController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to list agreement reports.
 */
const getAgreementReportsController = async (req, res) => {
  try {
    const result = await agreementService.getAgreementReports(req.query);
    res.status(200).json({
      message: "Agreement reports retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getAgreementReportsController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to get a specific agreement report by ID.
 */
const getAgreementReportByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await agreementService.getAgreementReportById(id);
    res.status(200).json({
      message: "Agreement report details retrieved successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error in getAgreementReportByIdController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to update agreement report status.
 */
const updateAgreementReportStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.admin.id;

    const report = await agreementService.updateAgreementReportStatus(adminId, id, status);
    res.status(200).json({
      message: "Agreement report status updated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error in updateAgreementReportStatusController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

/**
 * Controller to add an internal administrative note to an agreement.
 */
const addAgreementNoteController = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const note = await agreementService.addAgreementNote(adminId, req.body);
    res.status(201).json({
      message: "Administrative note added to agreement successfully",
      data: note,
    });
  } catch (error) {
    console.error("Error in addAgreementNoteController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

/**
 * Controller to retrieve agreement audit history.
 */
const getAgreementAuditHistoryController = async (req, res) => {
  try {
    const result = await agreementService.getAgreementAuditHistory(req.query);
    res.status(200).json({
      message: "Agreement audit history retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getAgreementAuditHistoryController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAgreementsController,
  getAgreementDetailsController,
  getAgreementActivityController,
  getAgreementReportsController,
  getAgreementReportByIdController,
  updateAgreementReportStatusController,
  addAgreementNoteController,
  getAgreementAuditHistoryController,
};
