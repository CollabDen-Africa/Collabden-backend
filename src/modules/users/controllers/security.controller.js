const securityService = require("../services/security.service");

const setup2FA = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await securityService.setup2FAService(userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const verify2FASetup = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;
    const result = await securityService.verify2FASetupService(userId, token);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const logoutAllDevices = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await securityService.logoutAllDevicesService(
      userId,
      req.ip || req.connection?.remoteAddress,
      req.headers['user-agent']
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const deactivateAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await securityService.deactivateAccountService(userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await securityService.deleteAccountService(userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const requestDataExport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await securityService.createDataExportRequestService(userId);
    res.status(202).json(result); // 202 Accepted
  } catch (error) {
    next(error);
  }
};

const checkDataExportStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const requestId = req.params.id;
    const result = await securityService.checkDataExportStatusService(userId, requestId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createSupportTicket = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { subject, message } = req.body;
    const result = await securityService.createSupportTicketService(userId, subject, message);
    res.status(201).json({ message: "Support ticket created", ticket: result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  setup2FA,
  verify2FASetup,
  logoutAllDevices,
  deactivateAccount,
  deleteAccount,
  requestDataExport,
  checkDataExportStatus,
  createSupportTicket,
};
