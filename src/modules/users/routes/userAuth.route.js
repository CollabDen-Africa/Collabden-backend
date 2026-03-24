const { Router } = require("express");
const { authController } = require("../controllers/index");

const validateRequest = require("../../../middleware/validateRequest");
const { signupSchema, loginSchema } = require("../../../schemas/auth.schema");
const { authMiddleware } = require("../../../middleware/auth.middleware");

const router = Router();

router.post("/signup", validateRequest(signupSchema), authController.SignUp);
router.post("/login", validateRequest(loginSchema), authController.Login);
router.get("/profile", authMiddleware, authController.profile);
router.post("/verify", authController.verifyEmail);
module.exports = router;