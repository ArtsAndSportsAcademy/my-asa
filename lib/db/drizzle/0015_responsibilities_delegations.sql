ALTER TYPE "responsibility_assignment_role" ADD VALUE IF NOT EXISTS 'VIEWER';
ALTER TABLE "delegations" ALTER COLUMN "valid_until" DROP NOT NULL;
