const {
  getDisputes,
  getDisputeById,
  assignDispute,
  updateDisputeStatus,
  addDisputeNote,
  getDisputeNotes,
  sendDisputeMessage,
  getDisputeMessages,
  requestDisputeEvidence,
  getDisputeEvidenceRequests,
  recordDisputeDecision,
  getDisputeAuditLogs,
} = require("../services/adminDisputes.service");

const getDisputesController = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      category,
      dateStart,
      dateEnd,
      assignedAdminId,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      status,
      category,
      dateStart,
      dateEnd,
      assignedAdminId,
      sortBy,
      sortOrder,
    };

    const data = await getDisputes(filters);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getDisputesController:", error);
    res.status(500).json({ error: error.message || "Failed to fetch disputes" });
  }
};

const getDisputeByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const dispute = await getDisputeById(id);
    res.status(200).json(dispute);
  } catch (error) {
    console.error("Error in getDisputeByIdController:", error);
    res.status(error.message === "Dispute not found" ? 404 : 500).json({
      error: error.message || "Failed to fetch dispute details",
    });
  }
};

const assignDisputeController = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId: targetAdminId } = req.body;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updated = await assignDispute(adminId, id, targetAdminId);
    res.status(200).json({
      message: targetAdminId ? "Dispute assigned successfully" : "Dispute unassigned successfully",
      dispute: updated,
    });
  } catch (error) {
    console.error("Error in assignDisputeController:", error);
    const statusCode =
      error.message === "Dispute not found" || error.message === "Target administrator not found"
        ? 404
        : 500;
    res.status(statusCode).json({ error: error.message || "Failed to assign dispute" });
  }
};

const updateDisputeStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user?.id;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updatedDispute = await updateDisputeStatus(adminId, id, status);
    res.status(200).json({ message: "Dispute status updated successfully", dispute: updatedDispute });
  } catch (error) {
    console.error("Error in updateDisputeStatusController:", error);
    const statusCode =
      error.message === "Dispute not found"
        ? 404
        : error.message.includes("Finalized")
        ? 400
        : 500;
    res.status(statusCode).json({ error: error.message || "Failed to update dispute status" });
  }
};

const addDisputeNoteController = async (req, res) => {
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

    const note = await addDisputeNote(adminId, id, content);
    res.status(201).json(note);
  } catch (error) {
    console.error("Error in addDisputeNoteController:", error);
    const statusCode = error.message === "Dispute not found" ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to add dispute note" });
  }
};

const getDisputeNotesController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;

    const query = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    };

    const data = await getDisputeNotes(id, query);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getDisputeNotesController:", error);
    const statusCode = error.message === "Dispute not found" ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to fetch dispute notes" });
  }
};

const sendDisputeMessageController = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, attachments, isInternal } = req.body;
    const adminId = req.user?.id;

    if (!message) {
      return res.status(400).json({ error: "Message content is required" });
    }
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = await sendDisputeMessage(adminId, id, { message, attachments, isInternal });
    res.status(201).json(data);
  } catch (error) {
    console.error("Error in sendDisputeMessageController:", error);
    const statusCode = error.message === "Dispute not found" ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to send dispute message" });
  }
};

const getDisputeMessagesController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;

    const query = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const data = await getDisputeMessages(id, query);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getDisputeMessagesController:", error);
    const statusCode = error.message === "Dispute not found" ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to fetch dispute messages" });
  }
};

const requestDisputeEvidenceController = async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedFrom, requestDetails, dueDate } = req.body;
    const adminId = req.user?.id;

    if (!requestedFrom || !requestDetails) {
      return res.status(400).json({ error: "requestedFrom and requestDetails are required" });
    }
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = await requestDisputeEvidence(adminId, id, { requestedFrom, requestDetails, dueDate });
    res.status(201).json(data);
  } catch (error) {
    console.error("Error in requestDisputeEvidenceController:", error);
    const statusCode =
      error.message === "Dispute not found" || error.message === "Requested user not found"
        ? 404
        : 500;
    res.status(statusCode).json({ error: error.message || "Failed to request evidence" });
  }
};

const getDisputeEvidenceRequestsController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit } = req.query;

    const query = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
    };

    const data = await getDisputeEvidenceRequests(id, query);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getDisputeEvidenceRequestsController:", error);
    const statusCode = error.message === "Dispute not found" ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to fetch evidence requests" });
  }
};

const recordDisputeDecisionController = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolutionSummary, outcome, supportingNotes, financialAdjustment } = req.body;
    const adminId = req.user?.id;

    if (!resolutionSummary || !outcome) {
      return res.status(400).json({ error: "resolutionSummary and outcome are required" });
    }
    if (!adminId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await recordDisputeDecision(adminId, id, {
      resolutionSummary,
      outcome,
      supportingNotes,
      financialAdjustment,
    });
    res.status(201).json({
      message: "Dispute decision recorded and finalized successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error in recordDisputeDecisionController:", error);
    const statusCode =
      error.message === "Dispute not found"
        ? 404
        : error.message.includes("already been finalized")
        ? 400
        : 500;
    res.status(statusCode).json({ error: error.message || "Failed to record dispute decision" });
  }
};

const getDisputeAuditLogsController = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, sortOrder } = req.query;

    const query = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      sortOrder: sortOrder || "asc",
    };

    const data = await getDisputeAuditLogs(id, query);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getDisputeAuditLogsController:", error);
    const statusCode = error.message === "Dispute not found" ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to fetch dispute audit logs" });
  }
};

module.exports = {
  getDisputesController,
  getDisputeByIdController,
  assignDisputeController,
  updateDisputeStatusController,
  addDisputeNoteController,
  getDisputeNotesController,
  sendDisputeMessageController,
  getDisputeMessagesController,
  requestDisputeEvidenceController,
  getDisputeEvidenceRequestsController,
  recordDisputeDecisionController,
  getDisputeAuditLogsController,
};
