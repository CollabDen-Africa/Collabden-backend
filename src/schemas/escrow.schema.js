const { z } = require("zod");

/**
 * Schema for configuring a new escrow on a project.
 * Validates total amount, collaborator allocations, milestones, and agreement linkage.
 * Milestones support multiple collaboratorIds — each collaborator tied to a milestone
 * receives the full milestone amount when approved.
 */
const configureEscrowSchema = z.object({
  totalAmount: z
    .number({ required_error: "Total escrow amount is required" })
    .min(1000, "Minimum escrow amount is ₦1,000"),
  agreementId: z
    .string({ required_error: "Agreement ID is required" })
    .min(1, "Agreement ID is required"),
  reviewPeriodDays: z
    .number()
    .int()
    .min(1, "Review period must be at least 1 day")
    .max(30, "Review period cannot exceed 30 days")
    .optional()
    .default(7),
  milestones: z
    .array(
      z.object({
        title: z
          .string({ required_error: "Milestone title is required" })
          .min(1, "Milestone title is required"),
        description: z.string().optional(),
        amount: z
          .number({ required_error: "Milestone amount is required" })
          .min(1, "Milestone amount must be positive"),
        dueDate: z.string().datetime().optional(),
        collaboratorIds: z
          .array(
            z.string({ required_error: "Collaborator ID is required" })
              .min(1, "Collaborator ID cannot be empty")
          )
          .min(1, "At least one collaborator must be assigned to each milestone"),
      })
    )
    .min(1, "At least one milestone is required"),
});

/**
 * Schema for approving, requesting changes, or rejecting an escrow proposal.
 */
const approveEscrowSchema = z.object({
  status: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"], {
    required_error: "Approval status is required",
  }),
  comment: z.string().optional(),
});

/**
 * Schema for submitting a milestone with supporting evidence.
 */
const submitMilestoneSchema = z.object({
  evidence: z.object({
    files: z.array(z.string()).optional().default([]),
    links: z.array(z.string().url("Each link must be a valid URL")).optional().default([]),
    documents: z.array(z.string()).optional().default([]),
    comment: z.string().optional().default(""),
  }),
});

/**
 * Schema for disputing a milestone.
 */
const disputeMilestoneSchema = z.object({
  reason: z
    .string({ required_error: "Dispute reason is required" })
    .min(10, "Dispute reason must be at least 10 characters"),
});

/**
 * Schema for admin resolution of an escrow dispute.
 */
const resolveDisputeSchema = z.object({
  resolution: z.enum(["APPROVE_RELEASE", "REJECT"], {
    required_error: "Resolution action is required",
  }),
  adminComment: z
    .string({ required_error: "Admin comment is required" })
    .min(5, "Admin comment must be at least 5 characters"),
});

module.exports = {
  configureEscrowSchema,
  approveEscrowSchema,
  submitMilestoneSchema,
  disputeMilestoneSchema,
  resolveDisputeSchema,
};
