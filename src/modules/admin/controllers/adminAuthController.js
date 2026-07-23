const catchAsync = require('../../../helpers/catchAsync');
const {
  adminLoginService,
  adminVerify2FAService,
  adminLogoutService,
  adminForgotPasswordService,
  adminResetPasswordService,
} = require("../services/adminAuth.service");

const AdminAuthController = {
  login: catchAsync(async (req, res) => {
    try {
      const loginData = await adminLoginService({
        ...req.body,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
      return res.status(200).json({
        message: loginData.message || "Admin logged in successfully",
        data: loginData,
      });
    } catch (error) {
      res.status(401).json({
        message: error.message,
      });
    }
  }),

  verify2FA: catchAsync(async (req, res) => {
    try {
      const { adminId, code } = req.body;
      const verifyData = await adminVerify2FAService(
        adminId, 
        code, 
        req.ip || req.connection?.remoteAddress, 
        req.headers['user-agent']
      );
      
      return res.status(200).json({
        message: "Admin verified and logged in successfully",
        data: verifyData,
      });
    } catch (error) {
      res.status(401).json({
        message: error.message,
      });
    }
  }),

  logout: catchAsync(async (req, res) => {
    try {
      const result = await adminLogoutService(
        req.user.id,
        req.ip || req.connection?.remoteAddress,
        req.headers['user-agent']
      );
      return res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }),

  me: catchAsync(async (req, res) => {
    return res.status(200).json({
      message: "Admin profile fetched successfully",
      data: req.user,
    });
  }),

  forgotPassword: catchAsync(async (req, res) => {
    try {
      const { email } = req.body;
      const result = await adminForgotPasswordService(
        email,
        req.ip || req.connection?.remoteAddress,
        req.headers['user-agent']
      );
      return res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }),

  resetPassword: catchAsync(async (req, res) => {
    try {
      const { resetToken, newPassword } = req.body;
      const result = await adminResetPasswordService(
        resetToken, 
        newPassword,
        req.ip || req.connection?.remoteAddress,
        req.headers['user-agent']
      );
      return res.status(200).json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }),
};

module.exports = AdminAuthController;
