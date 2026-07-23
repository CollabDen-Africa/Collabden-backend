const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = require("../../../config/prismaClient");
const { sendEmail } = require("../../../utils/sendEmail");
const { generateToken } = require("../../../utils/generateToken");
const {
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
} = require("../../../utils/emailTemplates");
const { sanitizeUser } = require("../../../utils/sanitizeUser");
const googleClient = require("../../../config/googleAuth");
const { ACCOUNT_STATUS, LOGIN_STATUS } = require("../../../config/constants");
const { verifySync } = require("otplib");
const userSignUpService = async ({ firstName, lastName, email, password }) => {
  if (!firstName || !firstName.trim()) {
    throw new Error("First name cannot be empty");
  }
  if (!lastName || !lastName.trim()) {
    throw new Error("Last name cannot be empty");
  }

  const normalizedEmail = email?.toLowerCase();

  const existingUser = await prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    if (
      !existingUser.isVerified &&
      existingUser.verificationTokenExpiry < new Date()
    ) {
      await prisma.userProfile.delete({ where: { email: normalizedEmail } });
    } else {
      throw new Error("Email already exists, please log in");
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomInt(100000, 999999).toString();

  const user = await prisma.userProfile.create({
    data: {
      firstName,
      lastName,
      email: normalizedEmail,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
      verificationTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const emailTemplate = getVerificationEmailTemplate(verificationToken);
  await sendEmail({
    to: normalizedEmail,
    subject: "Welcome to CollabDen - Verify Your Email",
    text: emailTemplate.text,
    html: emailTemplate.html,
  });
  return sanitizeUser(user);
};
const userLoginService = async ({
  email,
  password,
  ipAddress,
  userAgent,
  twoFactorCode,
}) => {
  const normalizedEmail = email?.toLowerCase();
  const user = await prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Lockout check
  if (user.lockoutUntil && new Date() < user.lockoutUntil) {
    const minutesLeft = Math.ceil(
      (user.lockoutUntil.getTime() - Date.now()) / 60000
    );
    throw new Error(
      `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minutes`
    );
  }

  // Helper for failed logins
  const handleFailedLogin = async () => {
    const newAttempts = user.failedLoginAttempts + 1;
    let lockoutUntil = null;
    if (newAttempts >= 5) {
      lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    await prisma.userProfile.update({
      where: { id: user.id },
      data: { failedLoginAttempts: newAttempts, lockoutUntil },
    });
    await prisma.loginActivity.create({
      data: {
        userId: user.id,
        ipAddress: ipAddress || "",
        userAgent: userAgent || "",
        status: LOGIN_STATUS.FAILED,
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: lockoutUntil ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
        changes: { reason: "Invalid credentials or 2FA code" },
        ipAddress,
        userAgent,
      },
    });
  };

  // Deactivated/Deleted check
  if (user.accountStatus === ACCOUNT_STATUS.DEACTIVATED) {
    throw new Error("Account is deactivated");
  } else if (user.accountStatus === ACCOUNT_STATUS.DELETED) {
    throw new Error("Account has been deleted");
  }

  if (!user.isVerified) {
    throw new Error("Please verify your account");
  }
  if (!user.password) {
    throw new Error("Please log in with your Google account");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    await handleFailedLogin();
    throw new Error("Invalid password");
  }

  // 2FA logic
  if (user.isTwoFactorEnabled) {
    if (!twoFactorCode) {
      return { requires2FA: true, message: "2FA code required" };
    }

    const isValidCode = verifySync({
      token: twoFactorCode,
      secret: user.twoFactorSecret,
    }).valid;
    if (!isValidCode) {
      await handleFailedLogin();
      throw new Error("Invalid 2FA code");
    }
  }

  // Reset failed login attempts and update activity
  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lastActiveAt: new Date(),
    },
  });

  // Log successful activity
  await prisma.loginActivity.create({
    data: {
      userId: user.id,
      ipAddress: ipAddress || "",
      userAgent: userAgent || "",
      status: LOGIN_STATUS.SUCCESS,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "LOGIN_SUCCESS",
      ipAddress,
      userAgent,
    },
  });

  const token = generateToken({
    id: user.id,
    email: user.email,
    isVerified: user.isVerified,
    onboardingCompleted: user.onboardingCompleted,
    tokenVersion: user.tokenVersion,
  });

  return {
    user: sanitizeUser(user),
    token,
  };
};
const verifyEmailService = async (email, verificationToken) => {
  const normalizedEmail = email?.toLowerCase();

  const user = await prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.verificationToken !== verificationToken) {
    throw new Error("Invalid verification token");
  }

  if (user.verificationTokenExpiry && new Date() > user.verificationTokenExpiry) {
    throw new Error("Verification token has expired");
  }

  if (user.isVerified) {
    throw new Error("Email is already verified");
  }

  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationToken: null, // Clear token after use
      verificationTokenExpiry: null, // Clear expiry as well
    },
  });

  return { message: "Email verified successfully" };
};

const resendVerificationEmailService = async (email) => {
  const normalizedEmail = email?.toLowerCase();

  const user = await prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.isVerified) {
    throw new Error("Email is already verified");
  }

  const verificationToken = crypto.randomInt(100000, 999999).toString();

  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      verificationToken,
      verificationTokenExpiry: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  const emailTemplate = getVerificationEmailTemplate(verificationToken);
  await sendEmail({
    to: normalizedEmail,
    subject: "Resend: Verify Your Email",
    text: emailTemplate.text,
    html: emailTemplate.html,
  });

  return { message: "Verification code resent successfully" };
};

const forgotPasswordService = async (email, ipAddress, userAgent) => {
  const normalizedEmail = email?.toLowerCase();

  const user = await prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new Error("User with this email not found");
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  // Token expires in 1 hour
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

  // Save reset token to database
  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiry,
    },
  });

  // Send reset email
  const emailTemplate = getPasswordResetEmailTemplate(resetToken);
  await sendEmail({
    to: normalizedEmail,
    subject: "Password Reset Request - CollabDen",
    text: emailTemplate.text,
    html: emailTemplate.html,
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      ipAddress,
      userAgent,
    },
  });

  return { message: "Password reset link sent to your email" };
};

const resetPasswordService = async (resetToken, newPassword, ipAddress, userAgent) => {
  const user = await prisma.userProfile.findUnique({
    where: { resetToken },
  });

  if (!user) {
    throw new Error("Invalid reset token");
  }

  // Check if token has expired
  if (new Date() > user.resetTokenExpiry) {
    throw new Error("Reset token has expired");
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update password and clear reset token
  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_RESET_COMPLETED",
      ipAddress,
      userAgent,
    },
  });

  return { message: "Password reset successfully" };
};

const googleAuthCallbackService = async (code) => {
  const { tokens } = await googleClient.getToken(code);

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  const { sub: googleId, email, given_name: firstName, family_name: lastName } = payload;
  const normalizedEmail = email?.toLowerCase();

  let user = await prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    user = await prisma.userProfile.create({
      data: {
        firstName,
        lastName,
        email: normalizedEmail,
        googleId,
        isVerified: true,
      },
    });
  } else if (!user.googleId) {
    user = await prisma.userProfile.update({
      where: { id: user.id },
      data: {
        googleId,
        isVerified: true,
      },
    });
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    isVerified: user.isVerified,
    onboardingCompleted: user.onboardingCompleted,
  });

  return {
    user: sanitizeUser(user),
    token,
  };
};

const updateOnboardingStatusService = async (userId, completed) => {
  const user = await prisma.userProfile.update({
    where: { id: userId },
    data: { onboardingCompleted: completed },
  });

  return sanitizeUser(user);
};

module.exports = {
  userSignUpService,
  userLoginService,
  verifyEmailService,
  resendVerificationEmailService,
  forgotPasswordService,
  resetPasswordService,
  googleAuthCallbackService,
  updateOnboardingStatusService,
};
