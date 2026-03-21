const { z } = require("zod");


const signupSchema = z.object({
  email: z.string().email("Invalid email format"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/\d/, "Password must include at least one number")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

module.exports = {
  signupSchema,
  loginSchema,
};