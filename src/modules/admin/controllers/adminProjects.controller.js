const {
  getProjects,
  getProjectById,
  getProjectActivity,
  getProjectReports,
  getAllProjectReports,
  getReportById,
  updateProjectReportStatus,
  getProjectNotes,
  addProjectNote,
  getProjectAuditHistory,
  moderateProject,
} = require("../services/adminProjects.service");

const getProjectsController = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      visibility,
      genre,
      dateCreatedStart,
      dateCreatedEnd,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      status,
      visibility,
      genre,
      dateCreatedStart,
      dateCreatedEnd,
      sortBy,
      sortOrder,
    };

    const data = await getProjects(filters);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getProjectsController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch projects" });
  }
};

const getProjectByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await getProjectById(id);
    res.status(200).json(project);
  } catch (error) {
    console.error("Error in getProjectByIdController:", error);
    res.status(error.message === "Project not found" ? 404 : 500).json({
      error: error.message || "Failed to fetch project details",
    });
  }
};

const getProjectActivityController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, search, type } = req.query;

    const query = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      type,
    };

    const data = await getProjectActivity(id, query);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getProjectActivityController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch project activity" });
  }
};

const getAllProjectReportsController = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      status,
    };

    const data = await getAllProjectReports(filters);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getAllProjectReportsController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch all reports" });
  }
};

const getReportByIdController = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await getReportById(reportId);
    res.status(200).json(report);
  } catch (error) {
    console.error("Error in getReportByIdController:", error);
    res.status(error.message === "Report not found" ? 404 : 500).json({
      error: error.message || "Failed to fetch report details",
    });
  }
};

const getProjectReportsController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, search, type } = req.query;

    const query = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      type,
    };

    const data = await getProjectReports(id, query);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getProjectReportsController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch project reports" });
  }
};

const updateProjectReportStatusController = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const report = await updateProjectReportStatus(reportId, status);
    res.status(200).json({ message: "Report status updated", report });
  } catch (error) {
    console.error("Error in updateProjectReportStatusController:", error);
    const statusCode = error.message === "Report not found" ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to update report status" });
  }
};

const getProjectNotesController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;

    const query = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    };

    const data = await getProjectNotes(id, query);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getProjectNotesController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch project notes" });
  }
};

const addProjectNoteController = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const adminId = req.user?.id;

    if (!content) {
      return res.status(400).json({ error: "Note content is required" });
    }
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const note = await addProjectNote(adminId, id, content);
    res.status(201).json(note);
  } catch (error) {
    console.error("Error in addProjectNoteController:", error);
    const statusCode = error.message === "Project not found" ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to add project note" });
  }
};

const getProjectAuditHistoryController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;

    const query = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    };

    const data = await getProjectAuditHistory(id, query);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getProjectAuditHistoryController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch project audit history" });
  }
};

const moderateProjectController = async (req, res) => {
  try {
    const { id } = req.params;
    const { actionType, reason, additionalNotes, notifyOwner } = req.body;
    const adminId = req.user?.id;

    if (!actionType || !reason) {
      return res.status(400).json({ error: "actionType and reason are required" });
    }
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await moderateProject(adminId, id, {
      actionType,
      reason,
      additionalNotes,
      notifyOwner,
    });

    res.status(200).json({
      message: `Project successfully ${actionType === "ARCHIVE" ? "archived" : "removed"}`,
      project: result,
    });
  } catch (error) {
    console.error("Error in moderateProjectController:", error);
    const statusCode = error.message === "Project not found" ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to moderate project" });
  }
};

module.exports = {
  getProjectsController,
  getProjectByIdController,
  getProjectActivityController,
  getAllProjectReportsController,
  getReportByIdController,
  getProjectReportsController,
  updateProjectReportStatusController,
  getProjectNotesController,
  addProjectNoteController,
  getProjectAuditHistoryController,
  moderateProjectController,
};
