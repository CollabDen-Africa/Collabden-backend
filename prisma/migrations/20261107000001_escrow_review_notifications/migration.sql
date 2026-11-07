-- Add escrow review notification types (remind, terms edit, collaborator removal)
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ESCROW_APPROVAL_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ESCROW_TERMS_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ESCROW_COLLABORATOR_REMOVED';
