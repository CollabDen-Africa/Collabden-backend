const { z } = require('zod');

const moderateProjectSchema = z.object({
  actionType: z.enum(['ARCHIVE', 'REMOVE'], {
    errorMap: () => ({ message: "actionType must be ARCHIVE or REMOVE" }),
  }),
  reason: z.string().min(1, "Reason is required"),
  additionalNotes: z.string().optional(),
  notifyOwner: z.boolean().optional().default(true),
});

const createProjectNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty"),
});

const updateProjectReportStatusSchema = z.object({
  status: z.enum(['OPEN', 'REVIEWED', 'ACTION_TAKEN', 'DISMISSED'], {
    errorMap: () => ({ message: "Status must be OPEN, REVIEWED, ACTION_TAKEN, or DISMISSED" }),
  }),
});

module.exports = {
  moderateProjectSchema,
  createProjectNoteSchema,
  updateProjectReportStatusSchema,
};
