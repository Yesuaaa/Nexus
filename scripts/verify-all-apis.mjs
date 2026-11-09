const API_BASE = "http://127.0.0.1:3001/api"

async function runAudit() {
  console.log(
    "🔍 ==================================================================",
  )
  console.log("       NEXUS PLATFORM COMPREHENSIVE MULTI-ROLE API AUDIT     ")
  console.log(
    "==================================================================\n",
  )

  const results = []

  async function checkEndpoint(name, path, options = {}) {
    const url = `${API_BASE}${path}`
    const start = performance.now()
    try {
      const res = await fetch(url, options)
      const duration = Math.round(performance.now() - start)
      let data = null
      const contentType = res.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        try {
          data = await res.json()
        } catch {
          data = null
        }
      }
      const isSuccess = res.status >= 200 && res.status < 400
      results.push({
        category: options.category || "General",
        name,
        path,
        method: options.method || "GET",
        status: res.status,
        duration,
        ok: isSuccess,
        error: isSuccess
          ? null
          : data?.error || data?.message || res.statusText,
      })
      const symbol = isSuccess ? "✔" : "❌"
      console.log(
        `${symbol} [${(options.method || "GET").padEnd(4)}] ${path.padEnd(46)} ${res.status} (${duration}ms)`,
      )
      if (!isSuccess && data) {
        console.log(
          `   └─ Error: ${JSON.stringify(data.error || data.message || data)}`,
        )
      }
      return { status: res.status, data }
    } catch (err) {
      const duration = Math.round(performance.now() - start)
      results.push({
        category: options.category || "General",
        name,
        path,
        method: options.method || "GET",
        status: 0,
        duration,
        ok: false,
        error: err.message,
      })
      console.log(
        `❌ [${options.method || "GET"}] ${path.padEnd(46)} FAILED: ${err.message}`,
      )
      return { status: 0, error: err.message }
    }
  }

  // 1. Health & DB
  console.log("🟢 1. Health & Database Connectivity")
  await checkEndpoint("Health Check", "/health", { category: "Health" })
  await checkEndpoint("Database Pool", "/db-check", { category: "Health" })

  // 2. Superadmin
  console.log("\n👑 2. Superadmin Endpoints (Infrastructure & User Governance)")
  const superadminLogin = await checkEndpoint(
    "Superadmin Login",
    "/auth/login",
    {
      category: "Superadmin",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "superadmin@nexus.com",
        password: "superadmin123!",
      }),
    },
  )
  const superadminToken = superadminLogin.data?.token
  const superadminHeaders = {
    Authorization: `Bearer ${superadminToken}`,
    "Content-Type": "application/json",
  }

  await checkEndpoint("Get Current User (/auth/me)", "/auth/me", {
    category: "Superadmin",
    headers: superadminHeaders,
  })
  await checkEndpoint("Get Profile (/auth/profile)", "/auth/profile", {
    category: "Superadmin",
    headers: superadminHeaders,
  })
  await checkEndpoint("List User Accounts (/users)", "/users", {
    category: "Superadmin",
    headers: superadminHeaders,
  })
  await checkEndpoint("List Departments (/departments)", "/departments", {
    category: "Superadmin",
    headers: superadminHeaders,
  })
  await checkEndpoint(
    "Eligible Dept Heads (/departments/eligible-heads)",
    "/departments/eligible-heads",
    {
      category: "Superadmin",
      headers: superadminHeaders,
    },
  )
  await checkEndpoint(
    "Employee Assignment Options",
    "/departments/employee-options",
    {
      category: "Superadmin",
      headers: superadminHeaders,
    },
  )
  await checkEndpoint(
    "Internal Team Conversations",
    "/internal-conversations",
    {
      category: "Superadmin",
      headers: superadminHeaders,
    },
  )

  // 3. Admin Role
  console.log("\n🛡️ 3. Operations Admin Endpoints (Staff, Services & Pricing)")
  const adminLogin = await checkEndpoint("Admin Login", "/auth/login", {
    category: "Admin",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test@gmail.com",
      password: "AdminPassword123!",
    }),
  })
  const adminToken = adminLogin.data?.token
  const adminHeaders = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  }

  await checkEndpoint(
    "List Employees Directory",
    "/employees?page=1&limit=10",
    {
      category: "Admin",
      headers: adminHeaders,
    },
  )
  await checkEndpoint("Available Services (Active)", "/services/available", {
    category: "Admin",
    headers: adminHeaders,
  })
  await checkEndpoint("All Services (Admin Catalog)", "/services", {
    category: "Admin",
    headers: adminHeaders,
  })
  await checkEndpoint(
    "Service Pricing Templates",
    "/services/pricing-templates",
    {
      category: "Admin",
      headers: adminHeaders,
    },
  )

  // 4. Client / Mobile
  console.log("\n📱 4. Client / Mobile Endpoints (Discovery & Self-Service)")
  const clientRegister = await checkEndpoint(
    "Client Self-Registration",
    "/auth/register",
    {
      category: "Client",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Automated Client",
        contactNumber: "09123456789",
        email: `client_audit_${Date.now()}@example.com`,
        password: "Password123!@#",
      }),
    },
  )
  const clientToken = clientRegister.data?.token
  const clientHeaders = {
    Authorization: `Bearer ${clientToken}`,
    "Content-Type": "application/json",
  }

  await checkEndpoint("Active Client Services Catalog", "/client/services", {
    category: "Client",
    headers: clientHeaders,
  })
  await checkEndpoint(
    "Client Booking History",
    "/client/service-requests?page=1&pageSize=10",
    {
      category: "Client",
      headers: clientHeaders,
    },
  )

  // 5. Department Head
  console.log("\n👔 5. Department Head Endpoints (Inbox & Workload Capacity)")
  const headLogin = await checkEndpoint(
    "Department Head Login",
    "/auth/login",
    {
      category: "DeptHead",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "headdeptwency@nexus.com",
        password: "HeadPassword123!",
      }),
    },
  )
  const headToken = headLogin.data?.token
  const headHeaders = {
    Authorization: `Bearer ${headToken}`,
    "Content-Type": "application/json",
  }

  await checkEndpoint("Department Request Inbox", "/request-inbox", {
    category: "DeptHead",
    headers: headHeaders,
  })
  await checkEndpoint(
    "Weekly Team Workload Capacity",
    "/workload?week=2026-11-02",
    {
      category: "DeptHead",
      headers: headHeaders,
    },
  )

  // Summary
  console.log(
    "\n==================================================================",
  )
  console.log(
    "                        AUDIT SUMMARY                             ",
  )
  console.log(
    "==================================================================",
  )
  const total = results.length
  const passed = results.filter((r) => r.ok).length
  const failed = total - passed
  console.log(`Total Endpoints Audited:  ${total}`)
  console.log(`Passed (2xx):             ${passed}`)
  console.log(`Failed / Errors:          ${failed}`)

  if (failed > 0) {
    console.log("\nIssues Found:")
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`- [${r.method}] ${r.path} -> Status ${r.status}: ${r.error}`)
    }
    process.exit(1)
  } else {
    console.log("\n🎉 ALL CHECKED APIS ARE 100% OPERATIONAL ACROSS ALL ROLES!")
    process.exit(0)
  }
}

runAudit().catch((err) => {
  console.error("Fatal audit error:", err)
  process.exit(1)
})
