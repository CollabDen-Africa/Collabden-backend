const marketplaceService = require("../services/adminMarketplace.service");

/**
 * Controller to get marketplace listings (profiles and project postings) with filters, sorting, and pagination.
 */
const getListingsController = async (req, res) => {
  try {
    const result = await marketplaceService.getMarketplaceListings(req.query);
    res.status(200).json({
      message: "Marketplace listings retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getListingsController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to get collaborator profile details.
 */
const getCollaboratorDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await marketplaceService.getCollaboratorProfileDetails(id);
    res.status(200).json({
      message: "Collaborator profile details retrieved successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Error in getCollaboratorDetailsController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to get project posting details.
 */
const getProjectPostingDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await marketplaceService.getProjectPostingDetails(id);
    res.status(200).json({
      message: "Project posting details retrieved successfully",
      data: project,
    });
  } catch (error) {
    console.error("Error in getProjectPostingDetailsController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to list marketplace reports.
 */
const getReportsController = async (req, res) => {
  try {
    const result = await marketplaceService.getMarketplaceReports(req.query);
    res.status(200).json({
      message: "Marketplace reports retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getReportsController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to get report by ID.
 */
const getReportByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await marketplaceService.getMarketplaceReportById(id);
    res.status(200).json({
      message: "Marketplace report details retrieved successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error in getReportByIdController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to update report status.
 */
const updateReportStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.admin.id;

    const report = await marketplaceService.updateMarketplaceReportStatus(adminId, id, status);
    res.status(200).json({
      message: "Marketplace report status updated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error in updateReportStatusController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

/**
 * Controller to add an internal administrative note on marketplace content.
 */
const addMarketplaceNoteController = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const note = await marketplaceService.addMarketplaceNote(adminId, req.body);
    res.status(201).json({
      message: "Administrative note added successfully",
      data: note,
    });
  } catch (error) {
    console.error("Error in addMarketplaceNoteController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

/**
 * Controller to moderate collaborator profile.
 */
const moderateProfileController = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    const profile = await marketplaceService.moderateCollaboratorProfile(
      adminId,
      id,
      req.body,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      message: `Collaborator profile moderated successfully (${req.body.action})`,
      data: profile,
    });
  } catch (error) {
    console.error("Error in moderateProfileController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

/**
 * Controller to moderate project posting.
 */
const moderateProjectController = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    const project = await marketplaceService.moderateProjectPosting(
      adminId,
      id,
      req.body,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      message: `Project posting moderated successfully (${req.body.action})`,
      data: project,
    });
  } catch (error) {
    console.error("Error in moderateProjectController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

/**
 * Controller to retrieve marketplace audit history.
 */
const getMarketplaceAuditHistoryController = async (req, res) => {
  try {
    const result = await marketplaceService.getMarketplaceAuditHistory(req.query);
    res.status(200).json({
      message: "Marketplace audit history retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getMarketplaceAuditHistoryController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getListingsController,
  getCollaboratorDetailsController,
  getProjectPostingDetailsController,
  getReportsController,
  getReportByIdController,
  updateReportStatusController,
  addMarketplaceNoteController,
  moderateProfileController,
  moderateProjectController,
  getMarketplaceAuditHistoryController,
};
