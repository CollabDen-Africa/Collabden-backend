-- Migration: add_support_history_and_audit
-- FRA103, FRA104, FRA105, NFRA62, NFRA65
-- Adds resolution tracking fields to SupportTicket and an immutable audit log model.

-- Add resolution tracking fields to SupportTicket
ALTER TABLE "SupportTicket"
  ADD COLUMN "resolution"        TEXT,
  ADD COLUMN "resolvedAt"        TIMESTAMP(3),
  ADD COLUMN "resolvedByAdminId" TEXT,
  ADD COLUMN "firstResponseAt"   TIMESTAMP(3);

-- Add foreign key for resolvedByAdminId
ALTER TABLE "SupportTicket"
  ADD CONSTRAINT "SupportTicket_resolvedByAdminId_fkey"
    FOREIGN KEY ("resolvedByAdminId")
    REFERENCES "AdminUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for the new fields
CREATE INDEX "SupportTicket_resolvedByAdminId_idx" ON "SupportTicket"("resolvedByAdminId");
CREATE INDEX "SupportTicket_resolvedAt_idx"        ON "SupportTicket"("resolvedAt");

-- Create immutable SupportTicketAuditLog table (FRA105, NFRA65)
-- No UPDATE or DELETE is ever exposed via API — only INSERT and SELECT.
CREATE TABLE "SupportTicketAuditLog" (
  "id"             TEXT         NOT NULL,
  "ticketId"       TEXT         NOT NULL,
  "adminId"        TEXT         NOT NULL,
  "action"         TEXT         NOT NULL,
  "previousStatus" "SupportTicketStatus",
  "newStatus"      "SupportTicketStatus",
  "details"        JSONB        NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupportTicketAuditLog_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "SupportTicketAuditLog"
  ADD CONSTRAINT "SupportTicketAuditLog_ticketId_fkey"
    FOREIGN KEY ("ticketId")
    REFERENCES "SupportTicket"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportTicketAuditLog"
  ADD CONSTRAINT "SupportTicketAuditLog_adminId_fkey"
    FOREIGN KEY ("adminId")
    REFERENCES "AdminUser"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "SupportTicketAuditLog_ticketId_idx"  ON "SupportTicketAuditLog"("ticketId");
CREATE INDEX "SupportTicketAuditLog_adminId_idx"   ON "SupportTicketAuditLog"("adminId");
CREATE INDEX "SupportTicketAuditLog_action_idx"    ON "SupportTicketAuditLog"("action");
CREATE INDEX "SupportTicketAuditLog_createdAt_idx" ON "SupportTicketAuditLog"("createdAt");
