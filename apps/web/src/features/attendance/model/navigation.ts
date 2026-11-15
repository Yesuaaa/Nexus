export const attendanceNavigation = [
  {
    id: "attendance",
    label: "Attendance",
    access: "self",
    links: [
      {
        id: "attendance-overview",
        href: "/attendance/overview",
        label: "Overview",
        ariaLabel: "Attendance Overview",
        access: "self",
      },
      {
        id: "attendance-my",
        href: "/attendance/check-ins",
        label: "Check-Ins",
        access: "self",
      },
    ],
  },
  {
    id: "attendance-time-logs",
    label: "Time Logs",
    access: "manage",
    links: [
      {
        id: "attendance-logs-overview",
        href: "/attendance/time-logs/overview",
        label: "Overview",
        ariaLabel: "Time Logs Overview",
        access: "manage",
      },
      {
        id: "attendance-records",
        href: "/attendance/time-logs/records",
        label: "Records",
        access: "manage",
      },
      {
        id: "attendance-audit",
        href: "/attendance/time-logs/audit",
        label: "Audit Trail",
        access: "manage",
      },
    ],
  },
  {
    id: "attendance-requests",
    label: "Requests & Approvals",
    access: "self",
    links: [
      {
        id: "attendance-requests-overview",
        href: "/attendance/requests/overview",
        label: "Overview",
        ariaLabel: "Requests & Approvals Overview",
        access: "self",
      },
      {
        id: "attendance-overtime",
        href: "/attendance/requests/overtime",
        label: "Overtime",
        access: "self",
      },
      {
        id: "attendance-corrections",
        href: "/attendance/requests/corrections",
        label: "Corrections",
        access: "self",
      },
    ],
  },
  {
    id: "attendance-policies",
    label: "Policies",
    access: "configure",
    links: [
      {
        id: "attendance-policies-overview",
        href: "/attendance/policies/overview",
        label: "Overview",
        ariaLabel: "Policies Overview",
        access: "configure",
      },
      {
        id: "attendance-settings",
        href: "/attendance/policies/management",
        label: "Management",
        access: "configure",
      },
      {
        id: "attendance-assignments",
        href: "/attendance/policies/assignments",
        label: "Assignments",
        access: "configure",
      },
    ],
  },
  {
    id: "attendance-dashboard",
    label: "Dashboard",
    access: "manage",
    links: [
      {
        id: "attendance-dashboard-overview",
        href: "/attendance/dashboard",
        label: "Dashboard",
        ariaLabel: "Attendance & Monitoring Dashboard",
        access: "manage",
      },
    ],
  },
] as const
