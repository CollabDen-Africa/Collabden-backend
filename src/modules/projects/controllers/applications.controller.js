const {
  applyToProjectService,
  getProjectApplicationsService,
  getMyApplicationsService,
  getApplicationDetailsService,
  sendApplicationMessageService,
  getApplicationMessagesService,
  reviewApplicationService,
  cancelApplicationService,
} = require("../services/applications.service");

const applyToProject = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const applicantId = req.user.id;
    const { message } = req.body;

    const application = await applyToProjectService(projectId, applicantId, message);
    res.status(201).json({
      message: "Application submitted successfully.",
      application,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProjectApplications = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.params.id;
    const ownerId = req.user.id;

    const applications = await getProjectApplicationsService(projectId, ownerId);
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getMyApplications = async (req, res) => {
  try {
    const applicantId = req.user.id;

    const applications = await getMyApplicationsService(applicantId);
    res.status(200).json(applications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getApplicationDetails = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user.id;

    const application = await getApplicationDetailsService(applicationId, userId);
    res.status(200).json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const sendApplicationMessage = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const senderId = req.user.id;
    const { message: messageContent } = req.body;

    if (!messageContent) {
      return res.status(400).json({ error: "Message content is required." });
    }

    const message = await sendApplicationMessageService(applicationId, senderId, messageContent);
    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getApplicationMessages = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.user.id;

    const messages = await getApplicationMessagesService(applicationId, userId);
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const reviewApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const projectId = req.params.projectId || req.params.id;
    const ownerId = req.user.id;
    const { status } = req.body;

    let normalizedStatus = status ? String(status).toUpperCase() : "";
    if (normalizedStatus === "ACCEPT") normalizedStatus = "ACCEPTED";
    if (normalizedStatus === "DECLINE" || normalizedStatus === "DECLINED" || normalizedStatus === "REJECT") normalizedStatus = "REJECTED";
    if (normalizedStatus === "CANCEL" || normalizedStatus === "CANCELED") normalizedStatus = "CANCELLED";

    if (!normalizedStatus || !["ACCEPTED", "REJECTED", "CANCELLED"].includes(normalizedStatus)) {
      return res.status(400).json({ error: "Invalid status. Must be ACCEPTED, DECLINED, or CANCELLED." });
    }

    const application = await reviewApplicationService(applicationId, ownerId, status, projectId);
    res.status(200).json({
      message: `Application has been successfully ${normalizedStatus.toLowerCase()}.`,
      application,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const cancelApplication = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const projectId = req.params.projectId || req.params.id;
    const userId = req.user.id;

    const application = await cancelApplicationService(applicationId, userId, projectId);
    res.status(200).json({
      message: "Application has been successfully cancelled.",
      application,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  applyToProject,
  getProjectApplications,
  getMyApplications,
  getApplicationDetails,
  sendApplicationMessage,
  getApplicationMessages,
  reviewApplication,
  cancelApplication,
};
