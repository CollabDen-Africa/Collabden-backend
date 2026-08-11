const { z } = require("zod");

const updateDisputeStatusSchema = z.object({
  status: z.enum(["OPEN", "UNDER_REVIEW", "AWAITING_RESPONSE", "RESOLVED", "CLOSED"], {
    errorMap: () => ({
      message: "Status must be OPEN, UNDER_REVIEW, AWAITING_RESPONSE, RESOLVED, or CLOSED",
    }),
  }),
});

const createDisputeNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty"),
});

module.exports = {
  updateDisputeStatusSchema,
  createDisputeNoteSchema,
};
