const { z } = require("zod");

const VALID_STATUSES = ["All", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const VALID_CATEGORIES = [
  "All",
  "ACCOUNT",
  "BILLING",
  "TECHNICAL",
  "PROJECT",
  "COLLABORATION",
  "VERIFICATION",
  "DISPUTE",
  "OTHER",
];
const VALID_SORT_FIELDS = ["createdAt", "updatedAt", "status", "category", "subject"];

/**
 * Query schema for listing support tickets (FRA94, FRA95, FRA96).
 * Validates all search, filter, sort, and pagination parameters.
 */
const getSupportTicketsQuerySchema = z.object({
  // Pagination
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10)),

  // FRA95 – Search
  search: z.string().optional(),

  // FRA96 – Filters
  status: z.enum(VALID_STATUSES).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  assignedAdminId: z.string().optional(), // supports "unassigned" as a special value
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),

  // Sorting
  sortBy: z.enum(VALID_SORT_FIELDS).optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

const sendMessageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  isInternal: z.boolean().optional().default(false),
});

const supportHistoryQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  category: z.enum(VALID_CATEGORIES).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["resolvedAt", "createdAt", "category"]).optional().default("resolvedAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

const reportQuerySchema = z.object({
  groupBy: z.enum(["category", "status", "date"]).optional().default("category"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  granularity: z.enum(["daily", "weekly", "monthly"]).optional().default("monthly"),
});

const metricsQuerySchema = z.object({
  period: z.enum(["daily", "weekly", "monthly"]).optional().default("monthly"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
});

const auditHistoryQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  ticketId: z.string().optional(),
  adminId: z.string().optional(),
  action: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});


const assignTicketSchema = z.object({
  assignedAdminId: z.string().nullable(),
});

const updateStatusSchema = z
  .object({
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
    resolution: z
      .string()
      .min(1, "Resolution summary is required when resolving a ticket")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.status === "RESOLVED" && !data.resolution) return false;
      return true;
    },
    {
      message: "A resolution summary is required when marking a ticket as RESOLVED",
      path: ["resolution"],
    }
  );

const updateCategorySchema = z.object({
  category: z.enum([
    "ACCOUNT",
    "BILLING",
    "TECHNICAL",
    "PROJECT",
    "COLLABORATION",
    "VERIFICATION",
    "DISPUTE",
    "OTHER",
  ]),
});

module.exports = {
  getSupportTicketsQuerySchema,
  sendMessageSchema,
  supportHistoryQuerySchema,
  reportQuerySchema,
  metricsQuerySchema,
  auditHistoryQuerySchema,
  assignTicketSchema,
  updateStatusSchema,
  updateCategorySchema,
};
