const { z } = require("zod");

const updateAgreementReportStatusSchema = z.object({
  status: z.enum(["OPEN", "REVIEWED", "ACTION_TAKEN", "DISMISSED"], {
    errorMap: () => ({ message: "Status must be OPEN, REVIEWED, ACTION_TAKEN, or DISMISSED" }),
  }),
});

const createAgreementNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty"),
  targetAgreementId: z.string().min(1, "Agreement ID is required"),
});

module.exports = {
  updateAgreementReportStatusSchema,
  createAgreementNoteSchema,
};
