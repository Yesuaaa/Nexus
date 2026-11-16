-- Keep legacy enum labels for compatibility, but migrate requests to lifecycle states.
UPDATE "ServiceRequest" r SET status = CASE
  WHEN r.status = 'CANCELLED' OR p.status = 'CANCELLED' THEN 'CANCELLED'
  WHEN p.status = 'COMPLETED' THEN 'CONCLUDED'
  WHEN p.status IN ('IN_PROGRESS', 'ON_HOLD') THEN 'ACTIVATED'
  WHEN r.status = 'CLOSED' THEN 'CANCELLED'
  WHEN r.status IN ('ACTIVATED', 'CONCLUDED') THEN r.status::text
  WHEN r."acceptedDepartmentId" IS NOT NULL THEN 'UNDER_REVIEW'
  ELSE 'SUBMITTED'
END::"ServiceRequestStatus"
FROM (SELECT sr.id, project.status FROM "ServiceRequest" sr
      LEFT JOIN "Project" project ON project."requestId" = sr.id) p
WHERE p.id = r.id;
