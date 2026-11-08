# 📮 Nexus Postman API Workspace (Web & Mobile)

This directory contains the ready-to-import Postman Collection and Environment template designed for testing, verifying, and debugging the Nexus Capstone API across **Web**, **Admin**, and **Mobile** journeys.

## Authentication debugging

The YAML collection under `collections/` is the working source registered by
`.postman/resources.yaml`. `Nexus_Platform.postman_collection.json` is its portable
import copy; keep both copies synchronized when editing requests or scripts.
Select **Nexus - Local (Development)** and verify `baseUrl` is
`http://localhost:3001/api`. Empty placeholder environments and unused folders
have been removed; the development environment is the only YAML environment.

Run only **0. Authentication Diagnostics**, in its numbered order, with a
disposable development account configured in `user_email` and `user_password`.
It logs in, checks `/auth/me`, rotates both tokens, checks `/auth/me` again,
logs out, then checks that the revoked access and refresh tokens return `401`.
An unexpected response stops the run. The folder does not register accounts,
update profiles, or change passwords. Running the entire collection includes
those mutations and is not an authentication smoke test.

Login clears the previous token pair before sending. Login and refresh scripts
assert the status, token pair, and positive lifetime before storing credentials;
refresh also checks that the refresh token changed. Error responses clear both
saved tokens. Successful logout clears the saved pair. Registration is separate
and does not replace the current login session. Avoid defining `token` or
`refreshToken` in local, data, or other overriding scopes. If a request has a
transport error (no response), log in again before continuing: refresh may have
completed on the server even though Postman did not receive its response.

The diagnostic folder temporarily retains revoked credentials in
`diagnosticAccessToken` and `diagnosticRefreshToken` for its final assertions and
clears them at the end and on the next diagnostic login. If stopped early, clear
those variables manually before exporting an environment.

Export the Collection Runner results as JSON and remove passwords, Bearer
headers, token response fields, and environment secrets before sharing. Preserve
request order, names, methods, URLs, HTTP statuses, assertion messages, and error
bodies. YAML definitions contain no response history.

Run `node --test postman/auth-scripts.test.mjs` to check the scripts offline.
Backend session behavior is covered by the PGlite-based API tests, including
rotation, replay, expiry, logout, and inactive accounts.

Verification on 2026-11-08: the five Postman script checks and 21 isolated
authentication tests passed. To repeat the backend checks after compiling the API,
run `node --test --test-concurrency=1 apps/api/dist/features/auth/auth.test.js apps/api/dist/features/auth/auth.jwt.test.js apps/api/dist/jwt-session.test.js apps/api/dist/login-validation.test.js`.
The full API suite failed with transaction timeouts and cascading failures in
other modules; its failure is not evidence that the live Postman issue is fixed.
No backend behavior was changed in this pass.

| Finding                                                           | Evidence                                                            | Resolution                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Failed authentication could leave a stale token pair              | Login/refresh scripts only wrote tokens on success                  | Clear stale state and assert the response before saving both tokens |
| Logout left saved credentials behind                              | Logout had no response script                                       | Clear the pair after HTTP 204                                       |
| Full authentication folder mixes diagnostic and account mutations | Registration, password, profile, and logout requests share a folder | Add a separate ordered diagnostic folder                            |
| Live failure cause is not yet established                         | No exported run results are present                                 | Inspect a sanitized run export before claiming a backend fix        |

---

## 📁 Files Included

1. [**`Nexus_Platform.postman_collection.json`**](./Nexus_Platform.postman_collection.json)
   - **1. Health & System**: API health and Postgres database connection checks.
   - **2. Authentication & Session**: Login (with auto-saving JWT access & refresh tokens), Register, Profile, Change Password, Token Rotation, Logout.
   - **3. Mobile & Client Journey**: Service discovery, specialist directory, booking request drafts, booking history, request cancellation.
   - **4. Departments & Teams**: Department directory, eligible heads, assignment options.
   - **5. Employees & Staff**: Employee directory and staff creation.
   - **6. User Accounts & RBAC (Superadmin)**: Account listings, active status toggle, password resets.
   - **7. Services & Pricing Management**: Service catalog and pricing templates.
   - **8. Requests & Workflows**: Department request inbox, workflow snapshots, action execution.
   - **9. Projects & Workload**: Project tracking and team capacity overview.
   - **10. Messaging & Conversations**: Request message threads and internal staff communication.
2. [**`Nexus_Local.postman_environment.json`**](./Nexus_Local.postman_environment.json)
   - Local development environment template (`baseUrl`, `token`, `refreshToken`, `user_email`, `user_password`, etc.).

---

## 🚀 Setup Guide (Step-by-Step)

### Step 1: Import into Postman

1. Open the **Postman** desktop application (or web client).
2. Click **Import** in the top-left corner.
3. Select or drag-and-drop both files from this directory:
   - `Nexus_Platform.postman_collection.json`
   - `Nexus_Local.postman_environment.json`

### Step 2: Select the Environment

1. In the top-right corner of Postman, click the environment dropdown.
2. Choose **`Nexus - Local (Development)`**.

### Step 3: Configure Credentials & Sign In

1. Open **Environments** in the left sidebar and click **Nexus - Local (Development)**.
2. In the **Current Value** column, enter your credentials:
   - `user_email`: Your test user / admin email.
   - `user_password`: Your account password.
3. Save changes (`Ctrl + S`).
4. Go to **2. Authentication & Session → Login (Auto-saves token)** and click **Send**.
5. Once authenticated (`200 OK`), the post-response test script **automatically saves the Bearer token and refresh token into your environment**.
6. All other requests in the collection automatically inherit this token.

---

## 📱 Mobile Developer Notes

- **Port Forwarding with ADB**:
  If you are running the backend via Docker or local Node and testing on an Android Emulator or connected physical device, run:
  ```powershell
  adb reverse tcp:3001 tcp:3001
  ```
  _(Or run `pnpm dev:mobile` / `pnpm dev:mobile:docker`, which applies this automatically)._
- **Android Emulator Host Address**:
  If connecting directly from a standard Android Emulator without ADB reverse, use `http://10.0.2.2:3001/api` as your base URL instead of `localhost`.
