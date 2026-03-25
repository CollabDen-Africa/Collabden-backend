const bcrypt = require("bcryptjs")
const crypto = require("crypto");
const prisma = require("../../../config/prismaClient");
const { sendEmail } = require("../../../utils/sendEmail");
const { generateToken } = require("../../../utils/generateToken");
const { getVerificationEmailTemplate } = require("../../../utils/emailTemplates");
const { sanitizeUser } = require("../../../utils/sanitizeUser");

const userSignUpService = async ({ email, password }) => {
  const normalizedEmail = email?.toLowerCase();

  // Check if email exists
  const emailExist = await prisma.userProfile.findUnique({
    where: { email: normalizedEmail },
  });

  if (emailExist) {
    throw new Error("Email already exists, please log in");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString("hex");

  // Create user
  const user = await prisma.userProfile.create({
    data: {
      email: "normalizedEmail",
      password: hashedPassword,
      isVerified: false,
      verificationToken,
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
const userLoginService = (async ({email, password}) =>{
    const normalizedEmail = email?.toLowerCase();
    const user = await prisma.userProfile.findUnique({
        where: { email: normalizedEmail },
    });
    if(!user){
        throw new Error("User not found");
    }
    if (!user.isVerified) {
          throw new Error("Please verify your account");
        }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if(!isPasswordValid){
        throw new Error("Invalid password");
    }
    const token = generateToken({
        id: user.id,
        email: user.email,
        isVerified: user.isVerified,
      });

    return {
        user: sanitizeUser(user),
        token
    };
})
const verifyEmailService = async (verificationToken) => {
  const user = await prisma.userProfile.findUnique({
    where: { verificationToken },
  });

  if (!user) {
    throw new Error("Invalid verification token");
  }

  await prisma.userProfile.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationToken: null, // Clear token after use
    },
  });

  return { message: "Email verified successfully" };
};





module.exports = {
  userSignUpService,
  userLoginService,
  verifyEmailService,
};