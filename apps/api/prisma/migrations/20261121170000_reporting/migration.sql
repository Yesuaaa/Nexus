-- Older immutable rows predate snapshots issued by this release.
ALTER TABLE "AttendanceAudit" ADD COLUMN "writerTransaction" text;
ALTER TABLE "AttendanceAudit" ALTER COLUMN "writerTransaction" SET DEFAULT pg_current_xact_id()::text;
ALTER TABLE "LeaveDecision" ADD COLUMN "writerTransaction" text;
ALTER TABLE "LeaveDecision" ALTER COLUMN "writerTransaction" SET DEFAULT pg_current_xact_id()::text;
