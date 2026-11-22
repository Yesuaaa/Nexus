# Payroll disbursement foundation

A batch references the approved, complete calculation revision and its immutable employee snapshots. It never calculates compensation again. Preparation uses a database transaction, an advisory lock, and a unique calculation reference. Repeating preparation returns the original batch, including after cancellation. The workforce audit records preparation, validation, and cancellation in the same transaction as the batch change. Payslip publication is independent of batch preparation and settlement.

Admin can prepare, validate, and cancel. Superadmin can inspect. Positive net amounts are blocked pending verified destinations, zero net amounts require no payment, and malformed or non-PHP snapshots are rejected. There is no send endpoint. Real destination activation requires approved key management and destination verification. The local simulator generates synthetic bank or e-wallet fixtures and persists only four generated display digits. It accepts no account holder names or account numbers.

## PayMongo

- [Disbursements](https://docs.paymongo.com/docs/money-movement-disbursements) documents Philippine bank and e-wallet transfers, sandbox mode, status lookup, and transfer notifications.
- [API guide](https://docs.paymongo.com/docs/money-movement-moving-money-with-api) describes secret-key authentication and activated-wallet prerequisites.
- [Money Movement best practices](https://docs.paymongo.com/docs/money-movement-best-practices) documents an approximately 24-hour idempotency response window. Ambiguous attempts still require reconciliation, especially after that window.
- EXP's account approval, enabled rails, production permissions, transfer idempotency guarantees, and the selected endpoint's callback authentication still need confirmation before an adapter can send money.

## Reconciliation handoff

A future attempt must reference the approved payroll item and a verified immutable destination version. Persist its stable idempotency key before making a provider call. Treat a missing or ambiguous response as requiring reconciliation and retain the original attempt. An authenticated provider event or documented lookup may supply settlement evidence. Deduplicate events by provider event identity, reject stale transitions from terminal states, and expose unresolved outcomes to Admin. Staff salary acknowledgment requires persisted settlement evidence.

## Local setup and migration

- In the ignored `apps/api/.env` file, set `PAYROLL_LOCAL_SIMULATOR=true` and run the API in development mode against a disposable database. Production mode rejects simulator writes even if the flag is set. Each item accepts one immutable test destination and one attempt. Replay the same UUID and outcome to read the original result. A different UUID or outcome cannot replace an attempt, including pending or failed attempts.
- Configure the PayMongo **test** secret in `PAYMONGO_TEST_SECRET_KEY` in the same server-side file. The reserved variables `PAYMONGO_TEST_WALLET_ACCOUNT_NUMBER` and `PAYMONGO_TEST_WEBHOOK_SIGNING_SECRET` are for the future outbound test wallet and callback. The disabled adapter never reads these values or initiates a request. No frontend environment variables are needed.
- Apply `20261118100000_payroll_disbursement_foundation` before `20261118110000_payroll_disbursement_sandbox`. The latter backfills existing batches from approved payroll item amounts and adds unique constraints on original payroll item, sandbox destination, simulated attempt, and idempotency key.
