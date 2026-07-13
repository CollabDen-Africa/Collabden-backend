const escrowService = require("../services/escrow.service");
const milestoneService = require("../services/milestone.service");
const escrowReleaseService = require("../services/escrowRelease.service");

// ─── Escrow Configuration ───────────────────────────────────────────────────

const configureEscrow = async (req, res) => {
  try {
    const result = await escrowService.configureEscrow(
      req.params.projectId,
      req.user.id,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getProjectEscrow = async (req, res) => {
  try {
    const result = await escrowService.getEscrowByProject(
      req.params.projectId,
      req.user.id
    );
    res.status(200).json(result);
  } catch (error) {
    const status = error.message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

const getEscrowStatus = async (req, res) => {
  try {
    const result = await escrowService.getEscrowStatus(
      req.params.projectId,
      req.user.id
    );
    res.status(200).json(result);
  } catch (error) {
    const status = error.message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

const approveEscrowProposal = async (req, res) => {
  try {
    const result = await escrowService.approveEscrowProposal(
      req.params.projectId,
      req.user.id,
      req.body
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const fundEscrow = async (req, res) => {
  try {
    const result = await escrowService.fundEscrow(
      req.params.projectId,
      req.user.id
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Milestones ─────────────────────────────────────────────────────────────

const submitMilestone = async (req, res) => {
  try {
    const result = await milestoneService.submitMilestone(
      req.params.projectId,
      req.params.milestoneId,
      req.user.id,
      req.body.evidence
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const approveMilestone = async (req, res) => {
  try {
    const result = await milestoneService.approveMilestone(
      req.params.projectId,
      req.params.milestoneId,
      req.user.id
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getMilestone = async (req, res) => {
  try {
    const result = await milestoneService.getMilestoneDetails(
      req.params.projectId,
      req.params.milestoneId,
      req.user.id
    );
    res.status(200).json(result);
  } catch (error) {
    const status = error.message.includes("not found") ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
};

const disputeMilestone = async (req, res) => {
  try {
    const result = await milestoneService.disputeMilestone(
      req.params.projectId,
      req.params.milestoneId,
      req.user.id,
      req.body.reason
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const resolveDispute = async (req, res) => {
  try {
    const result = await milestoneService.resolveDispute(
      req.params.milestoneId,
      req.user.id,
      req.body
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ─── Payment History ────────────────────────────────────────────────────────

const getProjectPaymentHistory = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await escrowReleaseService.getProjectPaymentHistory(
      req.params.projectId,
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getPersonalEscrowPayments = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await escrowReleaseService.getPersonalEscrowPayments(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  configureEscrow,
  getProjectEscrow,
  getEscrowStatus,
  approveEscrowProposal,
  fundEscrow,
  submitMilestone,
  approveMilestone,
  getMilestone,
  disputeMilestone,
  resolveDispute,
  getProjectPaymentHistory,
  getPersonalEscrowPayments,
};
