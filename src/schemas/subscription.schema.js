const { z } = require("zod");

const subscribeSchema = z.object({
  tier: z.enum(["ADVANCE", "PRO", "ELITE"], {
    required_error: "Subscription tier is required.",
    invalid_type_error: "Invalid subscription tier. Must be ADVANCE, PRO, or ELITE.",
  }),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"], {
    required_error: "Billing cycle is required.",
    invalid_type_error: "Invalid billing cycle. Must be MONTHLY or ANNUAL.",
  }),
});

const savePaymentMethodSchema = z.object({
  token: z.string({ required_error: "Payment token is required." }),
  last4: z.string().optional(),
  brand: z.string().optional(),
  expMonth: z.number().optional(),
  expYear: z.number().optional(),
  type: z.enum(["CARD", "BANK_TRANSFER"]).optional(),
});

module.exports = {
  subscribeSchema,
  savePaymentMethodSchema,
};
