const { z } = require('zod');

const createAdminNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty"),
});

const userModerationSchema = z.object({
  action: z.enum(['SUSPEND', 'RESTRICT', 'REACTIVATE', 'BAN'], {
    errorMap: () => ({ message: "Action must be SUSPEND, RESTRICT, REACTIVATE, or BAN" }),
  }),
  reason: z.string().min(1, "Reason is required"),
});

module.exports = {
  createAdminNoteSchema,
  userModerationSchema,
};
