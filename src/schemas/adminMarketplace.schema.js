const { z } = require("zod");

const moderateMarketplaceProfileSchema = z.object({
  action: z.enum(["RESTRICT", "REMOVE", "RESTORE", "SUSPEND"], {
    errorMap: () => ({ message: "Action must be RESTRICT, REMOVE, RESTORE, or SUSPEND" }),
  }),
  reason: z.string().min(1, "Reason is required"),
  notifyUser: z.boolean().optional().default(true),
});

const moderateMarketplaceProjectSchema = z.object({
  action: z.enum(["RESTRICT", "REMOVE", "RESTORE"], {
    errorMap: () => ({ message: "Action must be RESTRICT, REMOVE, or RESTORE" }),
  }),
  reason: z.string().min(1, "Reason is required"),
  notifyOwner: z.boolean().optional().default(true),
});

const updateMarketplaceReportStatusSchema = z.object({
  status: z.enum(["OPEN", "REVIEWED", "ACTION_TAKEN", "DISMISSED"], {
    errorMap: () => ({ message: "Status must be OPEN, REVIEWED, ACTION_TAKEN, or DISMISSED" }),
  }),
});

const createMarketplaceNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty"),
  targetUserId: z.string().optional(),
  targetProjectId: z.string().optional(),
});

module.exports = {
  moderateMarketplaceProfileSchema,
  moderateMarketplaceProjectSchema,
  updateMarketplaceReportStatusSchema,
  createMarketplaceNoteSchema,
};
