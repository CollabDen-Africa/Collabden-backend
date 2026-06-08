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
const userLoginService = async ({ email, password }) => {
  const normalizedEmail = email?.toLowerCase();
  const user = await prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
  });
  if (!user) {
    throw new Error("User not found");
  }
  if (!user.isVerified) {
    throw new Error("Please verify your account");
  }
  if (!user.password) {
    throw new Error("Please log in with your Google account");
  }
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid password");
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

const forgotPasswordService = async (email) => {
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

  return { message: "Password reset link sent to your email" };
};

const resetPasswordService = async (resetToken, newPassword) => {
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
