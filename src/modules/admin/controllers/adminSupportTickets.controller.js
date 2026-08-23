const supportTicketsService = require("../services/adminSupportTickets.service");

/**
 * Controller to list all support tickets with search, filtering, sorting, and pagination.
 * FR: FRA94, FRA95, FRA96
 */
const getSupportTicketsController = async (req, res) => {
  try {
    const result = await supportTicketsService.getSupportTickets(req.query);
    res.status(200).json({
      message: "Support tickets retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getSupportTicketsController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to retrieve a single support ticket by ID.
 * FR: FRA94
 */
const getSupportTicketByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await supportTicketsService.getSupportTicketById(id);
    res.status(200).json({
      message: "Support ticket retrieved successfully",
      data: ticket,
    });
  } catch (error) {
    console.error("Error in getSupportTicketByIdController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Controller to retrieve summary counts for the support tickets overview.
 * FR: FRA94
 */
const getSupportTicketsSummaryController = async (req, res) => {
  try {
    const summary = await supportTicketsService.getSupportTicketsSummary();
    res.status(200).json({
      message: "Support tickets summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    console.error("Error in getSupportTicketsSummaryController:", error.message);
    res.status(500).json({ error: error.message });
  }
};


const sendMessageController = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const adminId = req.user.id;
    const { message, isInternal } = req.body;

    const result = await supportTicketsService.sendMessage(ticketId, adminId, {
      message,
      isInternal,
    });

    res.status(201).json({
      message: isInternal ? "Internal note added successfully" : "Response sent to user successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in sendMessageController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};


const getConversationHistoryController = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    
    const history = await supportTicketsService.getConversationHistory(ticketId, {
      includeInternal: true, 
    });

    res.status(200).json({
      message: "Conversation history retrieved successfully",
      data: history,
    });
  } catch (error) {
    console.error("Error in getConversationHistoryController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const getSupportHistoryController = async (req, res) => {
  try {
    const result = await supportTicketsService.getSupportHistory(req.query);
    res.status(200).json({
      message: "Support history retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getSupportHistoryController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

const getResolutionRecordController = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await supportTicketsService.getResolutionRecord(id);
    res.status(200).json({
      message: "Resolution record retrieved successfully",
      data: record,
    });
  } catch (error) {
    console.error("Error in getResolutionRecordController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const generateReportController = async (req, res) => {
  try {
    const report = await supportTicketsService.generateReport(req.query);
    res.status(200).json({
      message: "Support report generated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error in generateReportController:", error.message);
    res.status(500).json({ error: error.message });
  }
};


const getResponseResolutionMetricsController = async (req, res) => {
  try {
    const metrics = await supportTicketsService.getResponseResolutionMetrics(req.query);
    res.status(200).json({
      message: "Response and resolution metrics retrieved successfully",
      data: metrics,
    });
  } catch (error) {
    console.error("Error in getResponseResolutionMetricsController:", error.message);
    res.status(500).json({ error: error.message });
  }
};


const getSupportAuditHistoryController = async (req, res) => {
  try {
    const result = await supportTicketsService.getSupportAuditHistory(req.query);
    res.status(200).json({
      message: "Support audit history retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getSupportAuditHistoryController:", error.message);
    res.status(500).json({ error: error.message });
  }
};


const getTicketAuditHistoryController = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const result = await supportTicketsService.getSupportAuditHistory({
      ...req.query,
      ticketId,
    });
    res.status(200).json({
      message: "Ticket audit history retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getTicketAuditHistoryController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

const assignTicketController = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const actingAdminId = req.user.id;
    const { assignedAdminId } = req.body;

    const result = await supportTicketsService.assignTicket(ticketId, actingAdminId, {
      assignedAdminId,
    });

    const isUnassigning = assignedAdminId === null;
    res.status(200).json({
      message: isUnassigning
        ? "Ticket unassigned successfully"
        : "Ticket assigned successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in assignTicketController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};
const updateTicketStatusController = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const actingAdminId = req.user.id;
    const { status, resolution } = req.body;

    const result = await supportTicketsService.updateTicketStatus(ticketId, actingAdminId, {
      status,
      resolution,
    });

    res.status(200).json({
      message: `Ticket status updated to ${status} successfully`,
      data: result,
    });
  } catch (error) {
    console.error("Error in updateTicketStatusController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    if (
      error.message.includes("Invalid status transition") ||
      error.message.includes("already in") ||
      error.message.includes("resolution summary is required")
    ) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const updateTicketCategoryController = async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const actingAdminId = req.user.id;
    const { category } = req.body;

    const result = await supportTicketsService.updateTicketCategory(ticketId, actingAdminId, {
      category,
    });

    res.status(200).json({
      message: `Ticket category updated to ${category} successfully`,
      data: result,
    });
  } catch (error) {
    console.error("Error in updateTicketCategoryController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("already set to")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getSupportTicketsController,
  getSupportTicketByIdController,
  getSupportTicketsSummaryController,
  sendMessageController,
  getConversationHistoryController,
  getSupportHistoryController,
  getResolutionRecordController,
  generateReportController,
  getResponseResolutionMetricsController,
  getSupportAuditHistoryController,
  getTicketAuditHistoryController,
  assignTicketController,
  updateTicketStatusController,
  updateTicketCategoryController,
};

