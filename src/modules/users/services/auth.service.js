const bcrypt = require("bcryptjs")
const crypto = require("crypto");
const prisma = require("../../../config/prismaClient");
const { sendEmail } = require("../../../utils/sendEmail");
const { generateToken } = require("../../../utils/generateToken");

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
      email: normalizedEmail,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
    },
  });

//   await sendEmail({
//     to: normalizedEmail,
//     subject: "Verify account",
//     text: `Verify: ${process.env.FRONTEND_URL}/verify/${verificationToken}`,
//   });
  return user;
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
        user,
        token
    };
})





module.exports = {
  userSignUpService,
  userLoginService,
};