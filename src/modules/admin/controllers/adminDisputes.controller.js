const {
  getDisputes,
  getDisputeById,
  addDisputeNote,
  getDisputeNotes,
  updateDisputeStatus,
} = require("../services/adminDisputes.service");

const getDisputesController = async (req, res) => {
  try {
    const {
      page,
      limit,
      search,
      status,
      dateStart,
      dateEnd,
      sortBy,
      sortOrder,
    } = req.query;

    const filters = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search,
      status,
      dateStart,
      dateEnd,
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
    res.status(500).json({ error: error.message || "Failed to fetch dispute notes" });
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
    const statusCode = error.message === "Dispute not found" ? 404 : 500;
    res.status(statusCode).json({ error: error.message || "Failed to update dispute status" });
  }
};

module.exports = {
  getDisputesController,
  getDisputeByIdController,
  addDisputeNoteController,
  getDisputeNotesController,
  updateDisputeStatusController,
};
