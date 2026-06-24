const { z } = require("zod");

/**
 * Schema for initializing wallet funding via Flutterwave.
 * Minimum funding amount is ₦100.
 */
const initializeFundingSchema = z.object({
  amount: z
    .number({ required_error: "Amount is required" })
    .min(100, "Minimum funding amount is ₦100"),
  paymentMethod: z
    .enum(["card", "banktransfer", "ussd"], {
      required_error: "Payment method is required",
    }),
});

/**
 * Schema for adding a bank account for withdrawals.
 */
const addBankAccountSchema = z.object({
  bankCode: z
    .string({ required_error: "Bank code is required" })
    .min(1, "Bank code is required"),
  accountNumber: z
    .string({ required_error: "Account number is required" })
    .length(10, "Account number must be 10 digits")
    .regex(/^\d+$/, "Account number must contain only digits"),
});

/**
 * Schema for requesting a withdrawal to a registered bank account.
 * Minimum withdrawal amount is ₦1,000.
 */
const requestWithdrawalSchema = z.object({
  bankAccountId: z
    .string({ required_error: "Bank account ID is required" })
    .min(1, "Bank account ID is required"),
  amount: z
    .number({ required_error: "Amount is required" })
    .min(1000, "Minimum withdrawal amount is ₦1,000"),
});

module.exports = {
  initializeFundingSchema,
  addBankAccountSchema,
  requestWithdrawalSchema,
};
