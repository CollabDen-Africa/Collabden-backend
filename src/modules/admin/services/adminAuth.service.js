const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = require("../../../config/prismaClient");
const { sendEmail } = require("../../../utils/sendEmail");
const { generateToken } = require("../../../utils/generateToken");
const { getPasswordResetEmailTemplate, getAdmin2FAEmailTemplate } = require("../../../utils/emailTemplates");
const { ACCOUNT_STATUS } = require("../../../config/constants");

const sanitizeAdmin = (admin) => {
  const { password, tokenVersion, resetToken, resetTokenExpiry, ...rest } = admin;
  return rest;
};

const adminLoginService = async ({ email, password, ipAddress, userAgent }) => {
  const normalizedEmail = email?.toLowerCase();
  const admin = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
  });

  if (!admin) {
    throw new Error("Admin user not found");
  }

  if (admin.accountStatus === ACCOUNT_STATUS.DEACTIVATED) {
    throw new Error("Account is deactivated");
  } else if (admin.accountStatus === ACCOUNT_STATUS.DELETED) {
    throw new Error("Account has been deleted");
  }

  if (admin.lockoutUntil && new Date() < admin.lockoutUntil) {
    const minutesLeft = Math.ceil((admin.lockoutUntil.getTime() - Date.now()) / 60000);
    throw new Error(`Account is locked due to too many failed attempts. Try again in ${minutesLeft} minutes`);
  }

  const isPasswordValid = await bcrypt.compare(password, admin.password);

  if (!isPasswordValid) {
    const newAttempts = admin.failedLoginAttempts + 1;
    let lockoutUntil = null;
    if (newAttempts >= 5) {
      lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 mins lockout
    }
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { failedLoginAttempts: newAttempts, lockoutUntil }
    });
    
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: lockoutUntil ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
        details: { reason: "Invalid password" },
        ipAddress,
        userAgent
      }
    });
    
    throw new Error("Invalid password");
  }

  if (admin.isTwoFactorEnabled) {
    // Generate a 6-digit OTP
    const twoFactorCode = crypto.randomInt(100000, 999999).toString();
    const twoFactorCodeExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    await prisma.adminUser.update({
      where: { id: admin.id },
      data: {
        twoFactorCode,
        twoFactorCodeExpiry,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      },
    });

    const emailTemplate = getAdmin2FAEmailTemplate(twoFactorCode);
    await sendEmail({
      to: normalizedEmail,
      subject: "Your Admin 2FA Verification Code - CollabDen",
      text: emailTemplate.text,
      html: emailTemplate.html,
    });

    return {
      requires2FA: true,
      message: "Verification code sent to your email",
      adminId: admin.id,
      email: admin.email,
    };
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lastActiveAt: new Date(),
    }
  });

  const token = generateToken({
    id: admin.id,
    email: admin.email,
    role: admin.role,
    isAdminAuth: true,
    tokenVersion: admin.tokenVersion,
  });

  return {
    admin: sanitizeAdmin(admin),
    token,
  };
};

const adminVerify2FAService = async (adminId, code, ipAddress, userAgent) => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new Error("Admin user not found");
  }

  if (admin.accountStatus === ACCOUNT_STATUS.DEACTIVATED) {
    throw new Error("Account is deactivated");
  } else if (admin.accountStatus === ACCOUNT_STATUS.DELETED) {
    throw new Error("Account has been deleted");
  }

  if (admin.lockoutUntil && new Date() < admin.lockoutUntil) {
    const minutesLeft = Math.ceil((admin.lockoutUntil.getTime() - Date.now()) / 60000);
    throw new Error(`Account is locked due to too many failed attempts. Try again in ${minutesLeft} minutes`);
  }

  if (!admin.twoFactorCode || admin.twoFactorCode !== code) {
    const newAttempts = admin.failedLoginAttempts + 1;
    let lockoutUntil = null;
    if (newAttempts >= 5) {
      lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { failedLoginAttempts: newAttempts, lockoutUntil }
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: lockoutUntil ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
        details: { reason: "Invalid 2FA code" },
        ipAddress,
        userAgent
      }
    });

    throw new Error("Invalid verification code");
  }

  if (new Date() > admin.twoFactorCodeExpiry) {
    throw new Error("Verification code has expired");
  }

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      twoFactorCode: null,
      twoFactorCodeExpiry: null,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lastActiveAt: new Date(),
    }
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: "LOGIN_SUCCESS",
      ipAddress,
      userAgent
    }
  });

  const token = generateToken({
    id: admin.id,
    email: admin.email,
    role: admin.role,
    isAdminAuth: true,
    tokenVersion: admin.tokenVersion,
  });

  return {
    admin: sanitizeAdmin(admin),
    token,
  };
};

const adminLogoutService = async (adminId, ipAddress, userAgent) => {
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { tokenVersion: { increment: 1 } },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: "LOGOUT",
      ipAddress,
      userAgent
    }
  });

  return { message: "Logged out successfully" };
};

const adminResend2FAService = async (adminId) => {
  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
  });

  if (!admin) {
    throw new Error("Admin user not found");
  }

  if (admin.accountStatus === ACCOUNT_STATUS.DEACTIVATED) {
    throw new Error("Account is deactivated");
  } else if (admin.accountStatus === ACCOUNT_STATUS.DELETED) {
    throw new Error("Account has been deleted");
  }

  if (admin.twoFactorCodeExpiry && new Date() < admin.twoFactorCodeExpiry) {
    const minutesLeft = Math.ceil((admin.twoFactorCodeExpiry.getTime() - Date.now()) / 60000);
    throw new Error(`You must wait ${minutesLeft} minutes before requesting a new code.`);
  }

  // Generate a new 6-digit OTP
  const twoFactorCode = crypto.randomInt(100000, 999999).toString();
  const twoFactorCodeExpiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      twoFactorCode,
      twoFactorCodeExpiry,
    },
  });

  const emailTemplate = getAdmin2FAEmailTemplate(twoFactorCode);
  await sendEmail({
    to: admin.email,
    subject: "Your New Admin 2FA Verification Code - CollabDen",
    text: emailTemplate.text,
    html: emailTemplate.html,
  });

  return {
    message: "A new verification code has been sent to your email",
  };
};

const adminForgotPasswordService = async (email, ipAddress, userAgent) => {
  const normalizedEmail = email?.toLowerCase();
  const admin = await prisma.adminUser.findUnique({
    where: { email: normalizedEmail },
  });

  if (!admin) {
    throw new Error("Admin with this email not found");
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { resetToken, resetTokenExpiry },
  });

  const emailTemplate = getPasswordResetEmailTemplate(resetToken);
  await sendEmail({
    to: normalizedEmail,
    subject: "Admin Password Reset Request - CollabDen",
    text: emailTemplate.text,
    html: emailTemplate.html,
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: "PASSWORD_RESET_REQUESTED",
      ipAddress,
      userAgent
    }
  });

  return { message: "Password reset link sent to your email" };
};

const adminResetPasswordService = async (resetToken, newPassword, ipAddress, userAgent) => {
  const admin = await prisma.adminUser.findUnique({
    where: { resetToken },
  });

  if (!admin) {
    throw new Error("Invalid reset token");
  }

  if (new Date() > admin.resetTokenExpiry) {
    throw new Error("Reset token has expired");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
      tokenVersion: { increment: 1 },
    },
  });

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: "PASSWORD_RESET_COMPLETED",
      ipAddress,
      userAgent
    }
  });

  return { message: "Password reset successfully" };
};

module.exports = {
  adminLoginService,
  adminVerify2FAService,
  adminResend2FAService,
  adminLogoutService,
  adminForgotPasswordService,
  adminResetPasswordService,
};
