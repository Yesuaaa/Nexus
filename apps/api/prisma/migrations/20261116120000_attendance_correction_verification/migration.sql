-- Corrections now share overtime's Department Head verification stage.
ALTER TABLE "AttendanceAdjustment" DROP CONSTRAINT attendance_verification_state;
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT attendance_verification_state CHECK (
  status::text <> 'VERIFIED' OR (
    "verifiedById" IS NOT NULL AND "verifiedAt" IS NOT NULL
    AND "verificationNote" IS NOT NULL AND "verifiedById" <> "requestedById"
  )
);
