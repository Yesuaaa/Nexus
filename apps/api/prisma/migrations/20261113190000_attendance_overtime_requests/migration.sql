ALTER TYPE "AttendanceAdjustmentStatus" ADD VALUE 'VERIFIED';
ALTER TABLE "AttendanceAdjustment"
  ADD COLUMN "type" VARCHAR(20) NOT NULL DEFAULT 'CORRECTION',
  ADD COLUMN "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "verifiedById" TEXT REFERENCES "User"(id) ON DELETE RESTRICT,
  ADD COLUMN "verifiedAt" TIMESTAMPTZ(3),
  ADD COLUMN "verificationNote" VARCHAR(2000),
  ADD CONSTRAINT attendance_request_type CHECK ("type" IN ('CORRECTION', 'OVERTIME')),
  ADD CONSTRAINT attendance_overtime_minutes CHECK (("type" = 'CORRECTION' AND "overtimeMinutes" = 0) OR ("type" = 'OVERTIME' AND "overtimeMinutes" > 0));
ALTER TABLE "AttendanceAdjustment" DROP CONSTRAINT attendance_review_state;
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT attendance_review_state CHECK (
  (status::text IN ('PENDING', 'VERIFIED') AND "reviewedAt" IS NULL AND "reviewedById" IS NULL)
  OR (status::text IN ('APPROVED', 'REJECTED') AND "reviewedAt" IS NOT NULL AND "reviewedById" IS NOT NULL)
);
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT attendance_verification_state CHECK (
  status::text <> 'VERIFIED' OR ("type" = 'OVERTIME' AND "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "verificationNote" IS NOT NULL AND "verifiedById" <> "requestedById")
);
