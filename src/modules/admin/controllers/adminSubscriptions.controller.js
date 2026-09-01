const adminSubscriptionsService = require("../services/adminSubscriptions.service");

/**
 * Task 1: Controller to list subscription records with search, filtering, summary counts, and pagination.
 * FR: FRA83, FRA84, FRA85 | NFR: NFRA52, NFRA57
 */
const getSubscriptionsController = async (req, res) => {
  try {
    const result = await adminSubscriptionsService.getSubscriptions(req.query);
    res.status(200).json({
      message: "Subscription records retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getSubscriptionsController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 2: Controller to retrieve detailed user subscription record.
 * FR: FRA86 | NFR: NFRA53, NFRA54, NFRA55
 */
const getSubscriptionDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminSubscriptionsService.getSubscriptionDetails(id);
    res.status(200).json({
      message: "Subscription details retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getSubscriptionDetailsController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 2: Controller to retrieve user billing history.
 * FR: FRA88 | NFR: NFRA53, NFRA54, NFRA55
 */
const getUserBillingHistoryController = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await adminSubscriptionsService.getUserBillingHistory(userId, req.query);
    res.status(200).json({
      message: "User billing history retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getUserBillingHistoryController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 2: Controller to retrieve subscription activity history (upgrades, downgrades, cancellations, renewals).
 * FR: FRA87
 */
const getSubscriptionActivityController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminSubscriptionsService.getSubscriptionActivities(id, req.query);
    res.status(200).json({
      message: "Subscription activity history retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getSubscriptionActivityController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 2 & Task 3: Controller to retrieve failed subscription payments and payment retry attempts.
 * FR: FRA90 | NFR: NFRA53
 */
const getFailedSubscriptionPaymentsController = async (req, res) => {
  try {
    const result = await adminSubscriptionsService.getFailedSubscriptionPayments(req.query);
    res.status(200).json({
      message: "Failed subscription payments retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getFailedSubscriptionPaymentsController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 3: Controller to retrieve subscription issues reported by users.
 * FR: FRA89
 */
const getSubscriptionIssuesController = async (req, res) => {
  try {
    const result = await adminSubscriptionsService.getSubscriptionIssues(req.query);
    res.status(200).json({
      message: "Subscription issues retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getSubscriptionIssuesController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 3: Controller to retrieve a single subscription issue by ID.
 * FR: FRA89
 */
const getSubscriptionIssueDetailsController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminSubscriptionsService.getSubscriptionIssueDetails(id);
    res.status(200).json({
      message: "Subscription issue details retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in getSubscriptionIssueDetailsController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 3: Controller to create a subscription issue.
 */
const createSubscriptionIssueController = async (req, res) => {
  try {
    const result = await adminSubscriptionsService.createSubscriptionIssue(req.body);
    res.status(201).json({
      message: "Subscription issue created successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in createSubscriptionIssueController:", error.message);
    if (error.message.includes("required")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 3: Controller to add an internal admin note to a subscription issue.
 * FR: FRA89
 */
const addSubscriptionIssueNoteController = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const { content } = req.body;

    const result = await adminSubscriptionsService.addSubscriptionIssueNote(adminId, id, content);
    res.status(201).json({
      message: "Internal note added to subscription issue successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in addSubscriptionIssueNoteController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("required")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 3: Controller to update subscription issue status and notify user.
 * FR: FRA89, FRA90
 */
const updateSubscriptionIssueStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const result = await adminSubscriptionsService.updateSubscriptionIssueStatus(adminId, id, req.body);
    res.status(200).json({
      message: "Subscription issue status updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in updateSubscriptionIssueStatusController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes("Invalid status")) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 4: Controller to retrieve all subscription plans.
 * FR: FRA91 | NFR: NFRA53
 */
const getSubscriptionPlansController = async (req, res) => {
  try {
    const plans = await adminSubscriptionsService.getSubscriptionPlans();
    res.status(200).json({
      message: "Subscription plans retrieved successfully",
      data: plans,
    });
  } catch (error) {
    console.error("Error in getSubscriptionPlansController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 4: Controller to retrieve single subscription plan details.
 * FR: FRA91 | NFR: NFRA53
 */
const getSubscriptionPlanByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await adminSubscriptionsService.getSubscriptionPlanById(id);
    res.status(200).json({
      message: "Subscription plan retrieved successfully",
      data: plan,
    });
  } catch (error) {
    console.error("Error in getSubscriptionPlanByIdController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 4: Controller to update subscription plan information and usage limits.
 * FR: FRA91 | NFR: NFRA53, NFRA56
 */
const updateSubscriptionPlanController = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    const result = await adminSubscriptionsService.updateSubscriptionPlan(adminId, id, req.body);
    res.status(200).json({
      message: "Subscription plan updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error in updateSubscriptionPlanController:", error.message);
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 5: Controller to generate subscription and billing reports.
 * FR: FRA92 | NFR: NFRA56, NFRA57
 */
const getSubscriptionReportsController = async (req, res) => {
  try {
    const report = await adminSubscriptionsService.getSubscriptionReports(req.query);
    res.status(200).json({
      message: "Subscription report generated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error in getSubscriptionReportsController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Task 5: Controller to retrieve read-only audit log history for subscription actions.
 * FR: FRA93 | NFR: NFRA56
 */
const getSubscriptionAuditHistoryController = async (req, res) => {
  try {
    const audit = await adminSubscriptionsService.getSubscriptionAuditHistory(req.query);
    res.status(200).json({
      message: "Subscription audit history retrieved successfully",
      data: audit,
    });
  } catch (error) {
    console.error("Error in getSubscriptionAuditHistoryController:", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getSubscriptionsController,
  getSubscriptionDetailsController,
  getUserBillingHistoryController,
  getSubscriptionActivityController,
  getFailedSubscriptionPaymentsController,
  getSubscriptionIssuesController,
  getSubscriptionIssueDetailsController,
  createSubscriptionIssueController,
  addSubscriptionIssueNoteController,
  updateSubscriptionIssueStatusController,
  getSubscriptionPlansController,
  getSubscriptionPlanByIdController,
  updateSubscriptionPlanController,
  getSubscriptionReportsController,
  getSubscriptionAuditHistoryController,
};
