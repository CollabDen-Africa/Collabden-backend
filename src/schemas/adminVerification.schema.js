const { z } = require("zod");

const getVerificationRequestsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  search: z.string().optional(),
  status: z
    .enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED", "INCOMPLETE", "All"])
    .optional(),
  verificationType: z.string().optional(),
  submissionDateFrom: z.string().optional(),
  submissionDateTo: z.string().optional(),
  sortBy: z
    .enum(["createdAt", "status", "verificationType", "updatedAt"])
    .optional()
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

const verificationDecisionSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"], {
      errorMap: () => ({
        message: "Status must be either APPROVED or REJECTED",
      }),
    }),
    rejectionReason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.status === "REJECTED") {
        return typeof data.rejectionReason === "string" && data.rejectionReason.trim().length > 0;
      }
      return true;
    },
    {
      message: "Rejection reason is required when status is REJECTED",
      path: ["rejectionReason"],
    }
  );

const getUserVerificationHistoryQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  status: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

const getVerificationAuditQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  search: z.string().optional(),
});

module.exports = {
  getVerificationRequestsQuerySchema,
  verificationDecisionSchema,
  getUserVerificationHistoryQuerySchema,
  getVerificationAuditQuerySchema,
};
