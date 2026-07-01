const prisma = require('../../../config/prismaClient');
const catchAsync = require('../../../helpers/catchAsync');
const {
  userSignUpService,
  userLoginService,
  verifyEmailService,
  resendVerificationEmailService,
  forgotPasswordService,
  resetPasswordService,
  googleAuthCallbackService,
  updateOnboardingStatusService,
} = require("../services/auth.service");
const googleClient = require("../../../config/googleAuth");
const { sanitizeUser } = require("../../../utils/sanitizeUser");

const AuthController = {
  SignUp: catchAsync(async (req, res) => {
    try {
      const createUser = await userSignUpService(req.body);
      return res.status(201).json({
        message: "User created successfully",
        data: createUser,
      });
    } catch (error) {
      res.status(400).json({
        message: error.message,
      });
    }
  }),
  Login: catchAsync(async (req, res) => {
    try {
      const loginUser = await userLoginService({
        ...req.body,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
      return res.status(200).json({
        message: "User logged in successfully",
        data: loginUser,
      });
    } catch (error) {
      res.status(400).json({
        message: error.message,
      });
    }
  }),
  profile: catchAsync(async (req, res) => {
    try {
      const user = await prisma.userProfile.findUnique({
        where: { id: req.user.id },
      });
      return res.status(200).json({
        message: "User profile fetched successfully",
        data: sanitizeUser(user),
      });
    } catch (error) {
      res.status(400).json({
        message: error.message,
      });
    }
  }),
  verifyEmail: catchAsync(async (req, res) => {
    try {
      const { email, verificationToken } = req.body;
      if (!email || !verificationToken) {
        throw new Error("Email and verification token are required");
      }
      await verifyEmailService(email, verificationToken);
      return res.status(200).json({
        message: "Email verified successfully",
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }),
  resendVerificationEmail: catchAsync(async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        throw new Error("Email is required");
      }
      const result = await resendVerificationEmailService(email);
      return res.status(200).json({
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }),
  forgotPassword: catchAsync(async (req, res) => {
    try {
      const { email } = req.body;
      const result = await forgotPasswordService(email);
      return res.status(200).json({
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }),
  resetPassword: catchAsync(async (req, res) => {
    try {
      const { resetToken, newPassword } = req.body;
      const result = await resetPasswordService(resetToken, newPassword);
      return res.status(200).json({
        message: result.message,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }),
  googleLogin: catchAsync(async (req, res) => {
    const url = googleClient.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
    });
    res.redirect(url);
  }),
  googleCallback: catchAsync(async (req, res) => {
    try {
      const code = req.query.code;
      if (!code) {
        return res
          .status(400)
          .json({ message: "Authorization code not provided" });
      }

      const result = await googleAuthCallbackService(code);

      const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_APP_URL;
      res.redirect(`${frontendUrl}/api/auth/google/callback?token=${result.token}`);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }),
  updateOnboardingStatus: catchAsync(async (req, res) => {
    try {
      const { completed } = req.body;
      const userId = req.user.id;
      const user = await updateOnboardingStatusService(userId, completed);
      return res.status(200).json({
        message: "Onboarding status updated successfully",
        data: user,
      });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }),
};

module.exports = AuthController