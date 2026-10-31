-- Chat remains a communication channel. These records authorize the business workflow.
CREATE TYPE "RequestWorkflowState" AS ENUM ('PENDING_REVIEW', 'CONSULTATION', 'QUOTATION_PENDING', 'CLIENT_APPROVAL', 'AGREEMENT_PAYMENT_PENDING', 'READY_FOR_ACTIVATION', 'ACTIVE_PROJECT', 'DECLINED', 'CANCELLED', 'REVISION_REQUESTED', 'ON_HOLD');
CREATE TYPE "WorkflowRequirementStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'COMPLETED');
CREATE TYPE "WorkflowQuotationStatus" AS ENUM ('PENDING_INTERNAL', 'SENT', 'ACCEPTED', 'DECLINED', 'REVISION_REQUESTED', 'SUPERSEDED');
CREATE TYPE "WorkflowDocumentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED');
CREATE TYPE "WorkflowPaymentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED');
CREATE TYPE "WorkflowConsultationStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "Service"
  ADD COLUMN "requiresAgreement" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requiresPayment" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requiresQuotationApproval" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RequestWorkflow" (
  "requestId" TEXT NOT NULL PRIMARY KEY REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "state" "RequestWorkflowState" NOT NULL DEFAULT 'CONSULTATION',
  "previousState" "RequestWorkflowState",
  "version" INTEGER NOT NULL DEFAULT 1,
  "consultationRequired" BOOLEAN NOT NULL DEFAULT false,
  "agreementRequired" BOOLEAN NOT NULL DEFAULT true,
  "paymentRequired" BOOLEAN NOT NULL DEFAULT true,
  "quotationApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
  "quotationApproverId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "paymentVerifierId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RequestWorkflow_version_positive" CHECK ("version" > 0)
);

-- Bounded, private document data is only returned by authorized download endpoints.
CREATE TABLE "WorkflowFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "RequestWorkflow"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "uploaderId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "uploadId" VARCHAR(36) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "mimeType" VARCHAR(100) NOT NULL,
  "size" INTEGER NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "data" BYTEA NOT NULL,
  "clientVisible" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowFile_size_positive" CHECK ("size" > 0)
);
CREATE UNIQUE INDEX "WorkflowFile_requestId_uploaderId_uploadId_key" ON "WorkflowFile"("requestId", "uploaderId", "uploadId");
CREATE INDEX "WorkflowFile_requestId_createdAt_idx" ON "WorkflowFile"("requestId", "createdAt");

CREATE TABLE "WorkflowRequirement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "RequestWorkflow"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" VARCHAR(300) NOT NULL,
  "details" VARCHAR(4000),
  "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "status" "WorkflowRequirementStatus" NOT NULL DEFAULT 'REQUESTED',
  "submission" VARCHAR(4000),
  "fileId" TEXT REFERENCES "WorkflowFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reviewNote" VARCHAR(2000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "WorkflowRequirement_requestId_createdAt_idx" ON "WorkflowRequirement"("requestId", "createdAt");

CREATE TABLE "WorkflowConsultation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "RequestWorkflow"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "location" VARCHAR(1000) NOT NULL,
  "notes" VARCHAR(2000),
  "status" "WorkflowConsultationStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowConsultation_time_order" CHECK ("endsAt" > "startsAt")
);
CREATE INDEX "WorkflowConsultation_requestId_startsAt_idx" ON "WorkflowConsultation"("requestId", "startsAt");

CREATE TABLE "WorkflowQuotation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "RequestWorkflow"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "version" INTEGER NOT NULL,
  "status" "WorkflowQuotationStatus" NOT NULL DEFAULT 'SENT',
  "scope" VARCHAR(6000) NOT NULL,
  "deliverables" TEXT[] NOT NULL,
  "lineItems" JSONB NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "timeline" VARCHAR(1000) NOT NULL,
  "paymentTerms" VARCHAR(2000) NOT NULL,
  "paymentDue" DECIMAL(12,2) NOT NULL,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "decisionNote" VARCHAR(2000),
  "createdById" TEXT NOT NULL,
  "internallyApprovedById" TEXT,
  "internallyApprovedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowQuotation_amounts" CHECK ("total" >= 0 AND "paymentDue" >= 0 AND "paymentDue" <= "total"),
  CONSTRAINT "WorkflowQuotation_version_positive" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "WorkflowQuotation_requestId_version_key" ON "WorkflowQuotation"("requestId", "version");

CREATE TABLE "WorkflowApproval" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "RequestWorkflow"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "quotationId" TEXT NOT NULL REFERENCES "WorkflowQuotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "approvedById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WorkflowApproval_requestId_key" ON "WorkflowApproval"("requestId");
CREATE UNIQUE INDEX "WorkflowApproval_quotationId_key" ON "WorkflowApproval"("quotationId");

CREATE TABLE "WorkflowAgreement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "RequestWorkflow"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "status" "WorkflowDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "documentFileId" TEXT REFERENCES "WorkflowFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "signedFileId" TEXT REFERENCES "WorkflowFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "WorkflowAgreement_requestId_key" ON "WorkflowAgreement"("requestId");

CREATE TABLE "WorkflowPayment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "RequestWorkflow"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "mandatory" BOOLEAN NOT NULL DEFAULT true,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "WorkflowPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "proofFileId" TEXT REFERENCES "WorkflowFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reference" VARCHAR(300),
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "WorkflowPayment_requestId_key" ON "WorkflowPayment"("requestId");

CREATE TABLE "WorkflowEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "RequestWorkflow"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "type" VARCHAR(60) NOT NULL,
  "summary" VARCHAR(4000) NOT NULL,
  "entityId" TEXT,
  "internal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WorkflowEvent_requestId_createdAt_id_idx" ON "WorkflowEvent"("requestId", "createdAt", "id");

CREATE TABLE "WorkflowActionReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "RequestWorkflow"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL,
  "actionId" VARCHAR(36) NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WorkflowActionReceipt_requestId_actorId_actionId_key" ON "WorkflowActionReceipt"("requestId", "actorId", "actionId");

CREATE TABLE "WorkflowNotification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "requestId" TEXT NOT NULL REFERENCES "RequestWorkflow"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "eventId" TEXT NOT NULL REFERENCES "WorkflowEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WorkflowNotification_userId_eventId_key" ON "WorkflowNotification"("userId", "eventId");
CREATE INDEX "WorkflowNotification_userId_readAt_createdAt_idx" ON "WorkflowNotification"("userId", "readAt", "createdAt");

ALTER TABLE "Project"
  ADD COLUMN "requestId" TEXT REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD COLUMN "quotationId" TEXT REFERENCES "WorkflowQuotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Project_requestId_key" ON "Project"("requestId");
CREATE UNIQUE INDEX "Project_quotationId_key" ON "Project"("quotationId");

CREATE TABLE "ProjectStaff" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ProjectStaff_projectId_employeeId_key" ON "ProjectStaff"("projectId", "employeeId");
CREATE INDEX "ProjectStaff_employeeId_idx" ON "ProjectStaff"("employeeId");

CREATE TABLE "ProjectMilestone" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" VARCHAR(300) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "displayOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "ProjectMilestone_projectId_displayOrder_idx" ON "ProjectMilestone"("projectId", "displayOrder");

-- Existing accepted requests enter consultation. Nothing is approved, paid or activated.
INSERT INTO "RequestWorkflow" ("requestId", "state", "consultationRequired", "agreementRequired", "paymentRequired", "quotationApprovalRequired", "createdAt", "updatedAt")
SELECT r."id", CASE WHEN r."status"::text = 'CANCELLED' THEN 'CANCELLED'::"RequestWorkflowState"
                    WHEN r."status"::text = 'CLOSED' THEN 'ON_HOLD'::"RequestWorkflowState"
                    ELSE 'CONSULTATION'::"RequestWorkflowState" END,
       s."requiresConsultation", s."requiresAgreement", s."requiresPayment", s."requiresQuotationApproval", r."acceptedAt", CURRENT_TIMESTAMP
FROM "ServiceRequest" r JOIN "Service" s ON s."id" = r."serviceId"
WHERE r."acceptedAt" IS NOT NULL AND r."acceptedDepartmentId" IS NOT NULL;

INSERT INTO "WorkflowRequirement" ("id", "requestId", "title", "mandatory", "status", "createdAt", "updatedAt")
SELECT 'req-' || md5(w."requestId" || ':' || requirement.ordinality::text), w."requestId", left(btrim(requirement.title), 300), true, 'REQUESTED', w."createdAt", CURRENT_TIMESTAMP
FROM "RequestWorkflow" w
JOIN "ServiceRequest" r ON r."id" = w."requestId"
JOIN "Service" s ON s."id" = r."serviceId"
CROSS JOIN LATERAL unnest(s."clientRequirements") WITH ORDINALITY AS requirement(title, ordinality)
WHERE length(btrim(requirement.title)) > 0;

INSERT INTO "WorkflowEvent" ("id", "requestId", "actorId", "type", "summary", "createdAt")
SELECT 'evt-' || md5(w."requestId"), w."requestId", r."acceptedById", 'CONSULTATION_OPENED', 'Request accepted for consultation. Service delivery requires formal quotation approval and commencement requirements.', w."createdAt"
FROM "RequestWorkflow" w JOIN "ServiceRequest" r ON r."id" = w."requestId";

INSERT INTO "WorkflowEvent" ("id", "requestId", "actorId", "type", "summary", "entityId", "createdAt")
SELECT 'evt-' || md5(requirement."id"), requirement."requestId", r."acceptedById", 'REQUIREMENT_REQUESTED', 'Required: ' || requirement."title", requirement."id", requirement."createdAt"
FROM "WorkflowRequirement" requirement JOIN "ServiceRequest" r ON r."id" = requirement."requestId";

-- No browser-facing Supabase role can bypass the API's record-scoped authorization.
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['RequestWorkflow', 'WorkflowRequirement', 'WorkflowFile', 'WorkflowConsultation', 'WorkflowQuotation', 'WorkflowApproval', 'WorkflowAgreement', 'WorkflowPayment', 'WorkflowEvent', 'WorkflowActionReceipt', 'WorkflowNotification', 'Project', 'ProjectStaff', 'ProjectMilestone'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', table_name);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', table_name);
    END IF;
  END LOOP;
END $$;

CREATE FUNCTION public.reject_workflow_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Workflow approvals and events are immutable' USING ERRCODE = '23514';
END $$;
REVOKE ALL ON FUNCTION public.reject_workflow_history_mutation() FROM PUBLIC;
CREATE TRIGGER workflow_approval_immutable BEFORE UPDATE OR DELETE ON "WorkflowApproval"
FOR EACH ROW EXECUTE FUNCTION public.reject_workflow_history_mutation();
CREATE TRIGGER workflow_event_immutable BEFORE UPDATE OR DELETE ON "WorkflowEvent"
FOR EACH ROW EXECUTE FUNCTION public.reject_workflow_history_mutation();

-- Reuse the private invalidation channel; never broadcast documents or internal content.
CREATE TRIGGER request_workflow_event_inserted AFTER INSERT ON "WorkflowEvent"
FOR EACH ROW EXECUTE FUNCTION public.notify_request_conversation();
