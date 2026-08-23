const { Router } = require("express");
const {
  getSupportTicketsController,
  getSupportTicketByIdController,
  getSupportTicketsSummaryController,
  sendMessageController,
  getConversationHistoryController,
  getSupportHistoryController,
  getResolutionRecordController,
  generateReportController,
  getResponseResolutionMetricsController,
  getSupportAuditHistoryController,
  getTicketAuditHistoryController,
  assignTicketController,
  updateTicketStatusController,
  updateTicketCategoryController,
} = require("../controllers/adminSupportTickets.controller");
const { adminMiddleware } = require("../../../middleware/admin.middleware");
const { checkPermission } = require("../../../middleware/checkPermission.middleware");
const validateRequest = require("../../../middleware/validateRequest");
const {
  sendMessageSchema,
  supportHistoryQuerySchema,
  reportQuerySchema,
  metricsQuerySchema,
  auditHistoryQuerySchema,
  assignTicketSchema,
  updateStatusSchema,
  updateCategorySchema,
} = require("../../../schemas/adminSupportTickets.schema");
const { ADMIN_PERMISSIONS } = require("../../../config/constants");

const router = Router();

router.use(adminMiddleware());


/**
 * @swagger
 * /api/v1/admin/support-tickets:
 *   get:
 *     summary: List all support tickets with search, filters, sorting, and pagination
 *     tags: [Admin Management - Support Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: "Search by ticket ID, user name, email, or category" }
 *       - { in: query, name: status, schema: { type: string, enum: [All, OPEN, IN_PROGRESS, RESOLVED, CLOSED] } }
 *       - { in: query, name: category, schema: { type: string, enum: [All, ACCOUNT, BILLING, TECHNICAL, PROJECT, COLLABORATION, VERIFICATION, DISPUTE, OTHER] } }
 *       - { in: query, name: assignedAdminId, schema: { type: string }, description: "Admin ID or 'unassigned'" }
 *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
 *       - { in: query, name: dateTo, schema: { type: string, format: date } }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [createdAt, updatedAt, status, category, subject], default: createdAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *     responses:
 *       200: { description: Support tickets retrieved successfully }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get("/", checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_VIEW), getSupportTicketsController);

/**
 * @swagger
 * /api/v1/admin/support-tickets/summary:
 *   get:
 *     summary: Get support ticket summary and category counts
 *     tags: [Admin Management - Support Tickets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Summary counts retrieved successfully }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get("/summary", checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_VIEW), getSupportTicketsSummaryController);

/**
 * @swagger
 * /api/v1/admin/support-tickets/history:
 *   get:
 *     summary: "List all resolved/closed tickets with resolution details"
 *     description: |
 *       Returns a paginated list of resolved and closed support tickets.
 *       Each record includes the issue category, resolution provided, date resolved,
 *       and the administrator responsible.
 *     tags: [Admin Management - Support History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: category, schema: { type: string, enum: [All, ACCOUNT, BILLING, TECHNICAL, PROJECT, COLLABORATION, VERIFICATION, DISPUTE, OTHER] } }
 *       - { in: query, name: dateFrom, schema: { type: string, format: date }, description: "Filter by resolution date (from)" }
 *       - { in: query, name: dateTo, schema: { type: string, format: date }, description: "Filter by resolution date (to)" }
 *       - { in: query, name: sortBy, schema: { type: string, enum: [resolvedAt, createdAt, category], default: resolvedAt } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *     responses:
 *       200:
 *         description: Support history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tickets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           subject: { type: string }
 *                           category: { type: string }
 *                           status: { type: string }
 *                           resolution: { type: string, description: "Resolution summary provided by admin" }
 *                           resolvedAt: { type: string, format: date-time }
 *                           resolvedByAdmin: { type: object }
 *                           user: { type: object }
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     totalPages: { type: integer }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get(
  "/history",
  checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_VIEW),
  getSupportHistoryController
);

/**
 * @swagger
 * /api/v1/admin/support-tickets/reports:
 *   get:
 *     summary: "Generate support reports grouped by category, status, or date"
 *     description: |
 *       Generates an aggregated report of support ticket activity.
 *       Supports grouping by issue category, resolution status, or date range.
 *       Includes total counts, resolution rates, and a summary breakdown.
 *     tags: [Admin Management - Support Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: groupBy, schema: { type: string, enum: [category, status, date], default: category }, description: "Dimension to group report by" }
 *       - { in: query, name: granularity, schema: { type: string, enum: [daily, weekly, monthly], default: monthly }, description: "Time granularity when groupBy=date" }
 *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
 *       - { in: query, name: dateTo, schema: { type: string, format: date } }
 *       - { in: query, name: category, schema: { type: string, enum: [All, ACCOUNT, BILLING, TECHNICAL, PROJECT, COLLABORATION, VERIFICATION, DISPUTE, OTHER] } }
 *       - { in: query, name: status, schema: { type: string, enum: [All, OPEN, IN_PROGRESS, RESOLVED, CLOSED] } }
 *     responses:
 *       200:
 *         description: Report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalCount: { type: integer }
 *                         resolvedCount: { type: integer }
 *                         resolutionRate: { type: string }
 *                     report: { type: object, description: "Grouped report data" }
 *                     generatedAt: { type: string, format: date-time }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get(
  "/reports",
  checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_VIEW),
  generateReportController
);


/**
 * @swagger
 * /api/v1/admin/support-tickets/metrics:
 *   get:
 *     summary: "Get response and resolution time metrics"
 *     description: |
 *       Returns average and median response times, resolution times,
 *       SLA compliance rate (target: first response within 4 hours),
 *       and per-category breakdowns. Only includes RESOLVED and CLOSED tickets.
 *     tags: [Admin Management - Support Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: period, schema: { type: string, enum: [daily, weekly, monthly], default: monthly } }
 *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
 *       - { in: query, name: dateTo, schema: { type: string, format: date } }
 *       - { in: query, name: category, schema: { type: string, enum: [All, ACCOUNT, BILLING, TECHNICAL, PROJECT, COLLABORATION, VERIFICATION, DISPUTE, OTHER] } }
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalResolved: { type: integer }
 *                     avgResponseTimeMinutes: { type: string }
 *                     avgResolutionTimeMinutes: { type: string }
 *                     medianResponseTimeMinutes: { type: string }
 *                     medianResolutionTimeMinutes: { type: string }
 *                     slaComplianceRate: { type: string }
 *                     byCategory: { type: array }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get(
  "/metrics",
  checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_VIEW),
  getResponseResolutionMetricsController
);


/**
 * @swagger
 * /api/v1/admin/support-tickets/audit-logs:
 *   get:
 *     summary: "Retrieve read-only system-wide support audit history"
 *     description: |
 *       Returns a paginated, immutable audit log of all administrative actions
 *       performed within the support system. Records display the action performed,
 *       the administrator responsible, and the date/time.
 *       Audit records CANNOT be edited or deleted — only GET is exposed.
 *     tags: [Admin Management - Support Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: ticketId, schema: { type: string }, description: "Filter logs for a specific ticket" }
 *       - { in: query, name: adminId, schema: { type: string }, description: "Filter logs by a specific admin" }
 *       - { in: query, name: action, schema: { type: string }, description: "Filter by action type (partial match)" }
 *       - { in: query, name: dateFrom, schema: { type: string, format: date } }
 *       - { in: query, name: dateTo, schema: { type: string, format: date } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200:
 *         description: Audit history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           action: { type: string }
 *                           previousStatus: { type: string }
 *                           newStatus: { type: string }
 *                           details: { type: object }
 *                           createdAt: { type: string, format: date-time }
 *                           admin: { type: object, description: "Administrator responsible" }
 *                           ticket: { type: object }
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     totalPages: { type: integer }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get(
  "/audit-logs",
  checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_VIEW),
  getSupportAuditHistoryController
);

/**
 * @swagger
 * /api/v1/admin/support-tickets/{id}:
 *   get:
 *     summary: Get a single support ticket by ID
 *     tags: [Admin Management - Support Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Support ticket retrieved successfully }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Support ticket not found }
 */
router.get("/:id", checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_VIEW), getSupportTicketByIdController);

/**
 * @swagger
 * /api/v1/admin/support-tickets/{id}/messages:
 *   get:
 *     summary: Get conversation history for a support ticket (including internal notes)
 *     tags: [Admin Management - Support Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Conversation history retrieved successfully }
 *       404: { description: Support ticket not found }
 *   post:
 *     summary: Send a response or add an internal note to a support ticket
 *     tags: [Admin Management - Support Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, description: "The response message or internal note" }
 *               isInternal: { type: boolean, default: false, description: "If true, message is an internal note visible only to admins" }
 *     responses:
 *       201: { description: Message sent successfully }
 *       400: { description: Invalid request data }
 *       404: { description: Support ticket not found }
 */
router.route("/:id/messages")
  .get(checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_VIEW), getConversationHistoryController)
  .post(
    checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_MANAGE),
    validateRequest(sendMessageSchema),
    sendMessageController
  );

/**
 * @swagger
 * /api/v1/admin/support-tickets/{id}/history:
 *   get:
 *     summary: " Get full resolution record for a single ticket"
 *     description: |
 *       Returns the complete resolution record for one ticket, including ticket details,
 *       full message conversation, audit trail, and computed response/resolution time metrics.
 *     tags: [Admin Management - Support History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Resolution record retrieved successfully }
 *       404: { description: Support ticket not found }
 */
router.get(
  "/:id/history",
  checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_VIEW),
  getResolutionRecordController
);

/**
 * @swagger
 * /api/v1/admin/support-tickets/{id}/audit-logs:
 *   get:
 *     summary: "Retrieve read-only audit log for a specific ticket"
 *     description: |
 *       Returns the immutable audit trail for all administrative actions taken
 *       on a specific support ticket. Records cannot be edited or deleted.
 *     tags: [Admin Management - Support Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Ticket audit history retrieved successfully }
 *       404: { description: Support ticket not found }
 */
router.get(
  "/:id/audit-logs",
  checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_VIEW),
  getTicketAuditHistoryController
);

/**
 * @swagger
 * /api/v1/admin/support-tickets/{id}/assign:
 *   patch:
 *     summary: "Assign, reassign, or unassign a support ticket"
 *     description: |
 *       Assigns a support ticket to a specific administrator.
 *       If the ticket already has an assignee, the action is treated as a reassignment.
 *       Pass `assignedAdminId: null` to unassign the ticket.
 *
 *       Audit actions recorded:
 *         - `ASSIGNED`   — no previous assignee
 *         - `REASSIGNED` — different admin was previously assigned
 *         - `UNASSIGNED` — ticket cleared of its assignee
 *
 *       The ticket user is notified when an admin is assigned.
 *       Only administrators with `support_tickets.manage` permission may call this endpoint.
 *     tags: [Admin Management - Support Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: "Support ticket ID" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignedAdminId]
 *             properties:
 *               assignedAdminId:
 *                 type: string
 *                 nullable: true
 *                 description: "Admin ID to assign the ticket to, or null to unassign"
 *                 example: "clxyz123adminid"
 *     responses:
 *       200:
 *         description: Ticket assigned/unassigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     assignedAdminId: { type: string, nullable: true }
 *                     assignedAdmin: { type: object }
 *                     updatedAt: { type: string, format: date-time }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — insufficient permissions }
 *       404: { description: Ticket or target admin not found }
 */
router.patch(
  "/:id/assign",
  checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_MANAGE),
  validateRequest(assignTicketSchema),
  assignTicketController
);

/**
 * @swagger
 * /api/v1/admin/support-tickets/{id}/status:
 *   patch:
 *     summary: "Update the status of a support ticket"
 *     description: |
 *       Updates the status of a support ticket throughout the resolution process.
 *
 *       **Valid status values:** OPEN, IN_PROGRESS, RESOLVED, CLOSED
 *
 *       **Transition rules:**
 *         - OPEN        → IN_PROGRESS, CLOSED
 *         - IN_PROGRESS → OPEN, RESOLVED, CLOSED
 *         - RESOLVED    → CLOSED
 *         - CLOSED      → (terminal, no further transitions)
 *
 *       **Resolving a ticket (→ RESOLVED):**
 *         - `resolution` field is **required** ( accurate resolution records)
 *         - `resolvedAt` and `resolvedByAdminId` are recorded automatically
 *
 *       **Closing a ticket (→ CLOSED):**
 *         - `resolvedAt` is stamped if not already set
  *
  *       The ticket user receives an in-app notification on every status change.
 *       Only `support_tickets.manage` admins may call this endpoint.
 *     tags: [Admin Management - Support Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: "Support ticket ID" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, RESOLVED, CLOSED]
 *                 description: "New status for the ticket"
 *               resolution:
 *                 type: string
 *                 description: "Resolution summary — required when status is RESOLVED"
 *                 example: "Refund processed and account credited within 3-5 business days."
 *     responses:
 *       200:
 *         description: Ticket status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     status: { type: string }
 *                     resolution: { type: string, nullable: true }
 *                     resolvedAt: { type: string, format: date-time, nullable: true }
 *                     resolvedByAdmin: { type: object, nullable: true }
 *                     assignedAdmin: { type: object, nullable: true }
 *                     updatedAt: { type: string, format: date-time }
 *       400: { description: "Invalid transition, already in status, or missing resolution" }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — insufficient permissions }
 *       404: { description: Ticket not found }
 */
router.patch(
  "/:id/status",
  checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_MANAGE),
  validateRequest(updateStatusSchema),
  updateTicketStatusController
);

/**
 * @swagger
 * /api/v1/admin/support-tickets/{id}/category:
 *   patch:
 *     summary: "Update the category of a support ticket"
 *     description: |
 *       Updates the category of a support ticket to help administrators route
 *       and prioritise requests.
 *
 *       An audit log entry is created recording the previous and new category.
 *       No user notification is sent (this is an internal administrative action).
 *     tags: [Admin Management - Support Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string }, description: "Support ticket ID" }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category]
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [ACCOUNT, BILLING, TECHNICAL, PROJECT, COLLABORATION, VERIFICATION, DISPUTE, OTHER]
 *                 description: "New category for the ticket"
 *                 example: "BILLING"
 *     responses:
 *       200:
 *         description: Ticket category updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     category: { type: string }
 *                     status: { type: string }
 *                     updatedAt: { type: string, format: date-time }
 *       400: { description: "Category already set to the provided value" }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden — insufficient permissions }
 *       404: { description: Ticket not found }
 */
router.patch(
  "/:id/category",
  checkPermission(ADMIN_PERMISSIONS.SUPPORT_TICKETS_MANAGE),
  validateRequest(updateCategorySchema),
  updateTicketCategoryController
);

module.exports = router;
