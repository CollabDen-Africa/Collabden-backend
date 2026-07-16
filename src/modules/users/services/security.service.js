const prisma = require("../../../config/prismaClient");
const { generateSecret, generateURI, verifySync } = require('otplib');
const qrcode = require('qrcode');
const { ACCOUNT_STATUS, DATA_EXPORT_STATUS } = require("../../../config/constants");
const { exportQueue } = require("../../../jobs/exportQueue");

const setup2FAService = async (userId) => {
  const user = await prisma.userProfile.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const secret = generateSecret();
  
  // Store secret in DB (not enabled yet until verified)
  await prisma.userProfile.update({
    where: { id: userId },
    data: { twoFactorSecret: secret },
  });

  const otpauth = generateURI({
    issuer: 'CollabDen',
    label: user.email,
    secret
  });
  const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

  return { secret, qrCodeDataUrl };
};

const verify2FASetupService = async (userId, token) => {
  const user = await prisma.userProfile.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorSecret) throw new Error("2FA not initiated");

  const isValid = verifySync({ token, secret: user.twoFactorSecret }).valid;
  if (!isValid) throw new Error("Invalid 2FA code");

  await prisma.userProfile.update({
    where: { id: userId },
    data: { isTwoFactorEnabled: true },
  });

  return { message: "2FA successfully enabled" };
};

const logoutAllDevicesService = async (userId, ipAddress, userAgent) => {
  await prisma.userProfile.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "LOGOUT_ALL_DEVICES",
      ipAddress,
      userAgent,
    },
  });

  return { message: "Successfully logged out from all devices" };
};

const deactivateAccountService = async (userId) => {
  await prisma.userProfile.update({
    where: { id: userId },
    data: { accountStatus: ACCOUNT_STATUS.DEACTIVATED },
  });

  return { message: "Account successfully deactivated" };
};

const deleteAccountService = async (userId) => {
  await prisma.userProfile.update({
    where: { id: userId },
    data: { accountStatus: ACCOUNT_STATUS.DELETED },
  });

  return { message: "Account deletion process started" };
};

const createDataExportRequestService = async (userId) => {
  // Create a pending request
  const request = await prisma.dataExportRequest.create({
    data: {
      userId,
      status: DATA_EXPORT_STATUS.PENDING,
    },
  });

  // Enqueue job in BullMQ
  await exportQueue.add("exportData", { userId, requestId: request.id });

  return { 
    message: "Data export requested", 
    requestId: request.id,
    status: DATA_EXPORT_STATUS.PENDING
  };
};

const checkDataExportStatusService = async (userId, requestId) => {
  const request = await prisma.dataExportRequest.findFirst({
    where: { 
      id: requestId,
      userId 
    },
  });

  if (!request) {
    throw new Error("Export request not found");
  }

  return {
    id: request.id,
    status: request.status,
    fileUrl: request.fileUrl,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
};

const createSupportTicketService = async (userId, subject, message) => {
  if (!subject || !message) throw new Error("Subject and message are required");

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      subject,
      message,
    },
  });

  return ticket;
};

module.exports = {
  setup2FAService,
  verify2FASetupService,
  logoutAllDevicesService,
  deactivateAccountService,
  deleteAccountService,
  createDataExportRequestService,
  checkDataExportStatusService,
  createSupportTicketService,
};
