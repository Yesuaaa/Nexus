# 📮 Nexus Postman API Workspace (Web & Mobile)

This directory contains the ready-to-import Postman Collection and Environment template designed for testing, verifying, and debugging the Nexus Capstone API across **Web**, **Admin**, and **Mobile** journeys.

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
