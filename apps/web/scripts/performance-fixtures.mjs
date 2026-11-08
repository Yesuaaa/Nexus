// Synthetic, read-only API responses for repeatable frontend measurements.
// These runs measure production rendering, not live database/API latency.
export function performanceFixtures(role) {
  const department = {
    id: "audit-dept",
    name: "Engineering",
    code: "ENG",
    color: "teal",
  }
  const permissions = [
    "dashboard:read",
    "profile:read",
    "profile:change-password",
    "departments:read",
    "departments:manage",
    "departments:delete",
    "employees:read",
    "employees:manage",
    "services:read",
    "services:manage",
    "clients:read",
  ]
  const user = {
    id: "audit-user",
    email: "audit@example.com",
    fullName: "Performance Audit",
    contactNumber: null,
    role: role === "user" ? "USER" : role === "head" ? "STAFF" : "ADMIN",
    isActive: true,
    permissions,
    createdAt: "2026-01-01T00:00:00.000Z",
    department,
    departmentId: department.id,
    headOf: role === "head" ? department : null,
  }
  const services = Array.from({ length: 24 }, (_, index) => ({
    id: `service-${index}`,
    name: `Digital Service ${index + 1}`,
    description:
      "Digital strategy, design and development services for your next business project.",
    iconKey: "code",
    imageUrl: null,
    imageAltText: null,
    clientRequirements: [],
    requiresConsultation: false,
    consultationNotes: null,
    keyBenefits: ["Clear delivery milestones", "Expert support"],
    isActive: true,
    pricingTemplateId: null,
    pricingTemplate: null,
    packages: [],
    departments: [department],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }))
  const employees = Array.from({ length: 10 }, (_, index) => ({
    id: `employee-${index}`,
    employeeId: `EMP-${index}`,
    accountRole: "STAFF",
    fullName: `Team Member ${index + 1}`,
    email: `member${index}@example.com`,
    imageUrl: null,
    contactNumber: null,
    position: "Developer",
    employmentType: "FULL_TIME",
    status: "ACTIVE",
    startDate: "2026-01-01",
    departmentId: department.id,
    teamId: null,
    department,
    team: null,
    hasAccount: true,
    accountIsActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }))
  return {
    "/api/auth/me": { user },
    "/api/auth/settings": {
      preferences: {
        timeZone: "Asia/Manila",
        dateFormat: "MM/DD/YYYY",
        timeFormat: "12h",
        workflowNotifications: true,
      },
      sessions: [],
    },
    "/api/request-workflows/notifications": {
      notifications: [],
      unreadCount: 0,
    },
    "/api/request-conversations": {
      conversations: [],
      nextCursor: null,
      unreadCount: 0,
    },
    "/api/internal-conversations": {
      conversations: [],
      nextCursor: null,
      unreadCount: 0,
    },
    "/api/internal-conversations/contacts": [],
    "/api/project-workspace": { workspaces: [], total: 0, nextCursor: null },
    "/api/services": { services },
    "/api/client/services": { services },
    "/api/services/pricing-templates": { templates: [] },
    "/api/departments": {
      departments: [
        {
          ...department,
          head: null,
          teams: [],
          members: [],
          _count: { members: 10, teams: 0 },
        },
      ],
    },
    "/api/employees": { employees, total: 100, page: 1, pageSize: 10 },
    "/api/workload": {
      department,
      week: "2026-11-02",
      projects: [],
      staff: Array.from({ length: 50 }, (_, index) => ({
        id: `staff-${index}`,
        fullName: `Team Member ${index + 1}`,
        position: "Developer",
        status: "ACTIVE",
        profileSpecialties: ["Development"],
        team: { id: "team-1", name: "Delivery" },
        capacity: { scheduledHours: 40, timeOffHours: 0 },
        assignments: [],
      })),
    },
  }
}
