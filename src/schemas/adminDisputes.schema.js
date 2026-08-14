const { z } = require("zod");

const getDisputesQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  search: z.string().optional(),
  status: z
    .enum(["OPEN", "UNDER_REVIEW", "AWAITING_RESPONSE", "RESOLVED", "CLOSED", "All"])
    .optional(),
  category: z
    .enum([
      "PAYMENT",
      "ESCROW_MILESTONE",
      "AGREEMENT_RELATED",
      "PROJECT_COLLABORATION",
      "USER_CONDUCT",
      "All",
    ])
    .optional(),
  dateStart: z.string().optional(),
  dateEnd: z.string().optional(),
  assignedAdminId: z.string().optional(),
  sortBy: z.enum(["createdAt", "status", "reason", "category"]).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

const updateDisputeStatusSchema = z.object({
  status: z.enum(["OPEN", "UNDER_REVIEW", "AWAITING_RESPONSE", "RESOLVED", "CLOSED"], {
    errorMap: () => ({
      message: "Status must be OPEN, UNDER_REVIEW, AWAITING_RESPONSE, RESOLVED, or CLOSED",
    }),
  }),
});

const assignDisputeSchema = z.object({
  adminId: z.string().nullable().optional(),
});

const createDisputeNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty"),
});

const createDisputeMessageSchema = z.object({
  message: z.string().min(1, "Message content cannot be empty"),
  attachments: z.array(z.any()).optional().default([]),
  isInternal: z.boolean().optional().default(false),
});

const requestEvidenceSchema = z.object({
  requestedFrom: z.string().min(1, "Target user ID (requestedFrom) is required"),
  requestDetails: z.string().min(1, "Request details cannot be empty"),
  dueDate: z.string().optional(),
});

const createDisputeDecisionSchema = z.object({
  resolutionSummary: z.string().min(1, "Resolution summary is required"),
  outcome: z.string().min(1, "Resolution outcome is required"),
  supportingNotes: z.string().optional(),
  financialAdjustment: z.record(z.any()).optional().default({}),
});

module.exports = {
  getDisputesQuerySchema,
  updateDisputeStatusSchema,
  assignDisputeSchema,
  createDisputeNoteSchema,
  createDisputeMessageSchema,
  requestEvidenceSchema,
  createDisputeDecisionSchema,
};
