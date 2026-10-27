# Superadmin Password Reset

- Developed: 2026-10-27
- Status: Implemented

## Behavior

Account Management gives a Superadmin a **Reset password** action for every other account. The modal identifies the selected account, requires a new password and confirmation, and provides independent show/hide controls. The current Superadmin cannot reset their own password here; they use the authenticated change-password flow.

`PATCH /api/users/:id/password` accepts `{ "newPassword": "..." }` and requires the Superadmin-only `accounts:reset-password` permission. It requires 12–1024 bytes containing uppercase, lowercase, numeric, and special characters. The API hashes the password with the existing scrypt implementation, invalidates every target session, and returns 204 without exposing password material.

Each successful reset writes a `PASSWORD_RESET` AuditLog record with actor ID, target user ID, action, and timestamp. The record deliberately excludes plaintext passwords, hashes, and request payloads. Unauthorized requests return 403; missing or retired accounts return 404.
