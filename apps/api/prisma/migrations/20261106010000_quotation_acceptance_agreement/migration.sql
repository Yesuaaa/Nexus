-- Formal quotation acceptance satisfies the service agreement. Keep existing
-- documents and signed copies available as history without another signature gate.
UPDATE "WorkflowAgreement" agreement
SET "status" = 'APPROVED',
    "reviewedById" = approval."approvedById",
    "reviewedAt" = approval."approvedAt"
FROM "WorkflowApproval" approval
WHERE approval."requestId" = agreement."requestId"
  AND agreement."status" <> 'APPROVED';

-- Reconcile paid bookings that were waiting only for a separate agreement.
-- Held requests stay on hold and resume into the corrected state.
UPDATE "RequestWorkflow" workflow
SET "state" = CASE
      WHEN workflow."state" = 'AGREEMENT_PAYMENT_PENDING'
        THEN 'READY_FOR_ACTIVATION'::"RequestWorkflowState"
      ELSE workflow."state"
    END,
    "previousState" = CASE
      WHEN workflow."state" = 'ON_HOLD'
        AND workflow."previousState" = 'AGREEMENT_PAYMENT_PENDING'
        THEN 'READY_FOR_ACTIVATION'::"RequestWorkflowState"
      ELSE workflow."previousState"
    END,
    "version" = workflow."version" + 1,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
    SELECT 1 FROM "WorkflowApproval" approval
    WHERE approval."requestId" = workflow."requestId"
  )
  AND (
    workflow."state" = 'AGREEMENT_PAYMENT_PENDING'
    OR (workflow."state" = 'ON_HOLD' AND workflow."previousState" = 'AGREEMENT_PAYMENT_PENDING')
  )
  AND (NOT workflow."paymentRequired" OR EXISTS (
    SELECT 1 FROM "WorkflowPayment" payment
    WHERE payment."requestId" = workflow."requestId" AND payment."status" = 'VERIFIED'
  ))
  AND NOT EXISTS (
    SELECT 1 FROM "WorkflowRequirement" requirement
    WHERE requirement."requestId" = workflow."requestId"
      AND requirement."mandatory" AND requirement."status" <> 'COMPLETED'
  );
