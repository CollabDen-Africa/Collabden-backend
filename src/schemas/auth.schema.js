const { z } = require("zod");


const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/\d/, "Password must include at least one number")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter"),
  phone: z.string().optional(),
  dob: z.string().optional(),
  stageName: z.string().optional(),
  agreedToTerms: z.boolean().optional(),
  dobVerified: z.boolean().optional(),
  intent: z.enum(["buyer", "seller", "both"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/\d/, "Password must include at least one number")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter"),
});

module.exports = {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};