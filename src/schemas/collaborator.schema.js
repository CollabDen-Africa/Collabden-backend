const { z } = require("zod");

const updateAvailabilitySchema = z.object({
  openToCollaborate: z.boolean({
    required_error: "openToCollaborate status is required",
    invalid_type_error: "openToCollaborate must be a boolean",
  }),
});

module.exports = {
  updateAvailabilitySchema,
};
