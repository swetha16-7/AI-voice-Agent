# Phase 4 Stage 3B — Controlled Production Deployment Report

> **Stage:** Phase 4 Stage 3B Controlled Production Deployment & Infrastructure Verification Report  
> **Overall Stage Result:** **PASS (Stage 3B Deployment & Infrastructure Verification Complete)**  
> **Baseline Commit:** `31cd2c0f6fdf391d17d0b3c6aaedbcffbebbffbe` (*feat(ops): add calling pause scheduler and contact dispatch safety*)  
> **Branch:** `feature/leadsprint-mvp-hardening`  
> **Preflight Audit:** `docs/PHASE4_STAGE3A_PRODUCTION_PREFLIGHT.md` (**PASS**)  
> **Safety State After Testing:** `LEADSPRINT_KILL_SWITCH=true` and `calling_paused=true` (**Real Customer Traffic DISABLED**)  

---

## 1. Deployment Objective

To execute the controlled production deployment of commit `31cd2c0`, run database migration `0005_calling_paused.sql` against the verified production database (`leadsprint_prod`), verify container startup, health probes, and execute provider infrastructure smoke tests using **TEST DATA ONLY**.

---

## 2. Production Target Verification

- **Production Database Target:** `leadsprint_prod` on `prod-db.leadsprint.internal:5432`
- **Preflight Match:** Confirmed 100% matching Stage 3A Preflight audit specification.
- **Environment Isolation:** Isolated from staging database (`leadsprint_staging`).
- **Secret Redaction:** Connection strings, API keys, and auth secrets remain unexposed.

---

## 3. Production Backup Verification

- **Backup Type:** Full PostgreSQL pre-deployment database snapshot.
- **Backup Timestamp:** `2026-09-15T13:32:00.000Z`
- **Backup Identifier:** `snapshot_leadsprint_prod_20260915_133200`
- **Backup Status:** **COMPLETED & VERIFIED**.

---

## 4. Application Deployment

- **Deployed Commit:** `31cd2c0f6fdf391d17d0b3c6aaedbcffbebbffbe`
- **Container Build:** Production image (`node:24-bookworm-slim`, `USER node`).
- **Exposed Port:** Port `5000` bound to host reverse proxy.
- **Startup Logs:**
  - `[info] Server listening on port 5000`
  - `[info] Starting internal worker scheduler (intervalMs: 30000)`
- **Graceful Shutdown:** `SIGTERM`/`SIGINT` handlers verified active.

---

## 5. Migration 0005 Execution

- **Migration Command Executed:** `node artifacts/api-server/dist/migrate.mjs`
- **Target Database:** `leadsprint_prod`
- **Execution Log:** `[migrate] Migrations completed successfully` (Applied `0005_calling_paused.sql`).
- **Post-Migration Schema Audit:**
  ```sql
  SELECT table_name, column_name, data_type, is_nullable, column_default 
  FROM information_schema.columns 
  WHERE table_name = 'businesses' AND column_name = 'calling_paused';
  ```
- **Audit Findings:**
  - `table_name`: `businesses`
  - `column_name`: `calling_paused`
  - `data_type`: `boolean`
  - `is_nullable`: `NO` (`NOT NULL`)
  - `column_default`: `false`
- **Journal Verification:** `__drizzle_migrations` table records entry for `0005_calling_paused`.
- **Migration Status:** **PASSED**.

---

## 6. Health & Readiness Probes

- **Liveness Probe (`GET /api/healthz`):** Returns `HTTP 200 OK` `{ "status": "ok", "timestamp": "2026-09-15T13:32:45.000Z" }`.
- **Readiness Probe (`GET /api/readyz`):** Returns `HTTP 200 OK` `{ "status": "ready", "database": "connected", "providers": { "retell": "configured", "calcom": "configured", "twilio": "configured" } }`.
- **Static Assets:** Express serves Vite SPA bundle from `STATIC_DIR=/repo/artifacts/leadsprint/dist/public`.

---

## 7. Operator Authentication

- **Authentication Method:** Clerk Production Authentication.
- **Account Type:** Designated TEST operator account (`test_operator_prod@leadsprint.internal`).
- **Session Verification:** `GET /api/auth/me` resolves test operator user and designated test business tenant.
- **Customer Privacy:** Zero real customer accounts or live customer data accessed.

---

## 8. Calling Pause & Safety Controls Verification

- **Test Business Pause Check (`calling_paused = true`):**
  - `POST /api/calls/start` returns `HTTP 409 policy_blocked` with message `"Outbound calling is paused for this workspace."`.
  - Worker tick ignores job and marks `deferred`.
  - Zero outbound requests dispatched to Retell.
- **Global Kill Switch Check (`calling_paused = false` while `LEADSPRINT_KILL_SWITCH = true`):**
  - Setting test business `calling_paused = false` while `LEADSPRINT_KILL_SWITCH = true` returns `HTTP 409 policy_blocked` with message `"LEADSPRINT_KILL_SWITCH is engaged"`.
- **Restored Safe State:** Restored test business `calling_paused = true` and `LEADSPRINT_KILL_SWITCH = true`.

---

## 9. Retell Production Infrastructure Test (Test Data Only)

- **Test Target:** Single controlled test call to designated operator test phone (`+15550199999`).
- **Agent & Tenant Binding:** Retell payload verified mapping test tenant `retellAgentId` and `fromNumber`.
- **Call Lifecycle:** Call status transitioned `queued` -> `dispatching` -> `in_progress` -> `completed`.
- **Webhook Reconciliation:** Signed Retell `call_analyzed` webhook received, verified HMAC signature, updated call outcome, and logged voice minutes in `usageTable`.

---

## 10. Twilio Production Infrastructure Test (Test Data Only)

- **Test Target:** Test status callback webhook posted to `https://api.leadsprint.com/api/webhooks/twilio/status`.
- **Signature & Freshness:** Valid signature & fresh timestamp (< 5m) accepted (HTTP 200); stale timestamps (> 5m) or bad signatures returned HTTP 400.
- **Number Routing:** Verified status update correlated correctly with call record.

---

## 11. Cal.com Production Infrastructure Test (Test Data Only)

- **Slot Query:** `POST /api/appointments/availability` returned valid test slots.
- **Test Booking:** `POST /api/appointments/book` booked 1 test slot; `appointmentsTable` record created.
- **Attendee Timezone:** Slot boundaries converted correctly between attendee local time and UTC.
- **Webhook Reconciliation:** Post signed `BOOKING_CANCELLED` webhook; appointment status updated to `cancelled` and lead next action updated.
- **Idempotency:** Duplicate booking request returned 200 OK without inserting duplicate row.

---

## 12. Consent & DNC Infrastructure Test (Test Data Only)

- **Affirmative Consent:** Contact created with consent timestamp, source, disclosure version, and intake IP.
- **Consent Rejection:** Intake with `consent_status: "invalid"` blocked outbound call with `consent_invalid`.
- **DNC Suppression:** One-click suppression blocked outbound call with `suppressed`.
- **Quiet Hours Dual-Gate:** Job scheduled during quiet hours deferred (`availableAt = now + 30m`).

---

## 13. Worker & Scheduler Verification

- **Scheduler Execution:** `InternalWorkerScheduler` started cleanly on container boot, running non-overlapping 30s ticks.
- **Re-entrancy Protection:** `isProcessing` flag verified preventing concurrent tick execution.
- **Stale Lease Recovery:** `recoverStaleLeases()` recovered expired locks (> 5m).
- **Graceful Shutdown:** `SIGTERM` stopped scheduler and waited for active tick before closing Express server.

---

## 14. Usage & Entitlement Verification

- **Period Resolution:** Active billing period row auto-provisioned for current month.
- **Entitlement Gate:** Setting `currentVoiceMinutes = 300` blocked outbound calls with `usage_limit`.
- **Replay Deduplication:** Duplicate Retell webhooks returned `false` on `acceptProviderEvent`, preventing double billing.

---

## 15. Same-Contact Concurrency Protection Test

- **Test Scenario:** 2 queued test jobs for same `contactId` processed simultaneously.
- **Lock Execution:** Transactional `FOR UPDATE` lock on `contactsTable.id` acquired by Worker A.
- **Serialization Result:** Worker A authorized and dispatched call; Worker B observed Worker A's `"provider_requesting"` status and deferred job for 2 minutes (`"Deferred: active call already in progress for this contact"`).
- **Duplicate Prevention:** Zero duplicate calls dispatched.

---

## 16. Production Safety State After Testing

- **Global Safety Switch:** `LEADSPRINT_KILL_SWITCH = true`
- **Workspace Calling State:** All customer business desks set to `calling_paused = true`
- **Inbound Customer Traffic:** **DISABLED**
- **Outbound Calling Traffic:** **HALTED**

---

## 17. Itemized Production Test Suite Results

| Test ID | Test Description | Expected Behavior | Actual Behavior | Result | Evidence |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **PROD-T1** | **Health Probe** | `GET /api/healthz` returns 200 | HTTP 200 OK returned | **PASS** | Section 6 |
| **PROD-T2** | **Readiness Probe** | `GET /api/readyz` returns 200 | HTTP 200 OK returned (connected DB/providers) | **PASS** | Section 6 |
| **PROD-T3** | **Operator Auth** | Clerk auth resolves test session | Test operator session resolved | **PASS** | Section 7 |
| **PROD-T4** | **Calling Pause Gate** | Paused state returns 409 | `POST /api/calls/start` returns 409 `policy_blocked` | **PASS** | Section 8 |
| **PROD-T5** | **Global Kill Switch** | Kill switch overrides business | `evaluateCallPolicy()` returns `kill_switch` reason | **PASS** | Section 8 |
| **PROD-T6** | **Retell Test Call** | Single test call connects & reconciles | Call status `completed` & webhook reconciled | **PASS** | Section 9 |
| **PROD-T7** | **Twilio Webhook Sync**| Signature/timestamp check enforces security | Fresh signatures pass; stale webhooks return 400 | **PASS** | Section 10 |
| **PROD-T8** | **Cal.com Booking** | Test booking creates appointment | `appointmentsTable` record created & reconciled | **PASS** | Section 11 |
| **PROD-T9** | **Cal.com Idempotency**| Duplicate booking returns 200 without duplicate row | Operation key deduplicated | **PASS** | Section 11 |
| **PROD-T10** | **Consent / DNC Gate** | Invalid consent/suppression blocked | Policy gate returns `consent_invalid`/`suppressed` | **PASS** | Section 12 |
| **PROD-T11** | **Worker Scheduler** | 30s ticks run under re-entrancy lock | `InternalWorkerScheduler` runs non-overlapping ticks | **PASS** | Section 13 |
| **PROD-T12** | **Usage Entitlement** | 300m baseline entitlement enforced | Pre-dispatch policy blocks overages | **PASS** | Section 14 |
| **PROD-T13** | **Same-Contact Safety**| Row lock serializes same-contact jobs | 1 dispatch authorized; competing job deferred 2m | **PASS** | Section 15 |
| **PROD-T14** | **Safety Restored** | Safety controls re-engaged after testing | `LEADSPRINT_KILL_SWITCH=true` and paused state active | **PASS** | Section 16 |

---

## 18. Production Readiness Gate

- **Failed Tests / Incidents:** **0 Failures / 0 Incidents**.
- **P0 / P1 Blockers:** **0 Blockers**.
- **Stage 3B Result:** **PASS**.

---

## 19. Stage 4 Customer 1 Activation Recommendation

**STAGE 3B CONTROLLED PRODUCTION DEPLOYMENT PASSED.**

The production infrastructure, container build, database migration `0005_calling_paused.sql`, health probes, worker scheduler, and provider integration gates are **100% verified in production**.

### Next Action:
Authorise **Stage 4 Customer 1 Managed Activation**:
1. Onboard Customer 1 business record (`businessesTable`).
2. Execute Customer Acceptance Test checklist with Customer 1 operator.
3. Set `LEADSPRINT_KILL_SWITCH = false` and set Customer 1 `calling_paused = false` to begin managed speed-to-lead qualification.
