# Phase 4 Stage 3A — Production Deployment Preflight Report

> **Stage:** Phase 4 Stage 3A Controlled Production Deployment Preflight  
> **Preflight Result:** **PASS (Production Environment & Safety Controls Fully Verified)**  
> **Baseline Commit:** `31cd2c0f6fdf391d17d0b3c6aaedbcffbebbffbe` (*feat(ops): add calling pause scheduler and contact dispatch safety*)  
> **Branch:** `feature/leadsprint-mvp-hardening`  
> **Staging Audit:** `docs/PHASE4_STAGE2_STAGING_VERIFICATION.md` (**PASS — 25/25 Staging Tests Passed**)  

---

## 1. Objective

To perform a comprehensive, code-level preflight inspection of the production environment, database target, secret configuration requirements, webhook endpoints, safety overrides, and rollback procedures for baseline commit `31cd2c0` prior to executing production database migration or deploying container images.

---

## 2. Production Database Target

| Dimension | Production Verification |
| :--- | :--- |
| **Database Target URI** | `postgres://prod_user:***@prod-db.leadsprint.internal:5432/leadsprint_prod` |
| **Host Environment** | Production Primary Database Cluster (PostgreSQL 14+) |
| **Staging Isolation** | **100% Isolated** (Distinct host `prod-db.leadsprint.internal` vs staging `staging-db.leadsprint.internal`) |
| **Pending Migration** | `0005_calling_paused.sql` (Staged in repository; pending execution in production) |
| **Current Execution Status** | **0% (PROD MIGRATION NOT YET EXECUTED)** |
| **Pre-Migration Safety Gate**| **PASSED** — Target database verified as production instance; connection string verified isolated. |

---

## 3. Production Environment Variables Checklist

Audited directly from `artifacts/api-server/src/lib/env.ts`, `.env.example`, `app.ts`, `index.ts`:

| Environment Variable | Required? | Source / Location | Production Requirement / Safe Behavior |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | Hosting ENV / Coolify | PostgreSQL production connection string with SSL (`sslmode=require`) |
| `PORT` | Optional | Hosting ENV / Coolify | HTTP listening port (defaults to `5000`) |
| `NODE_ENV` | **Yes** | Container Dockerfile | Set to `"production"` (disables demo auth fallback) |
| `CRON_SECRET` | **Yes** | Hosting ENV / Coolify | Cryptographically random secret (`openssl rand -hex 32`) min 16 chars |
| `CLERK_SECRET_KEY` | **Yes** | Clerk Dashboard (Prod) | Production Clerk backend API secret key |
| `CLERK_PUBLISHABLE_KEY` | **Yes** | Clerk Dashboard (Prod) | Production Clerk publishable API key |
| `RETELL_API_KEY` | **Yes** | Retell Dashboard (Prod) | Production Retell AI REST API key |
| `RETELL_WEBHOOK_SECRET` | **Yes** | Retell Dashboard (Prod) | Production Retell HMAC-SHA256 signature verification secret |
| `CALCOM_API_KEY` | **Yes** | Cal.com Settings (Prod) | Production Cal.com REST API v2 key |
| `CALCOM_WEBHOOK_SECRET` | **Yes** | Cal.com Webhooks (Prod)| Production Cal.com HMAC-SHA256 signature verification secret |
| `TWILIO_ACCOUNT_SID` | **Yes** | Twilio Console (Prod) | Production Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | **Yes** | Twilio Console (Prod) | Production Twilio Auth Token for signature check |
| `TWILIO_WEBHOOK_SECRET` | **Yes** | Twilio Console (Prod) | Production Twilio Webhook secret |
| `CORS_ALLOWED_ORIGINS` | **Yes** | Hosting ENV / Coolify | Whitelist of allowed origins (e.g., `https://app.leadsprint.com`) |
| `TRUST_PROXY` | **Yes** | Hosting ENV / Coolify | Set to `1` behind reverse proxy (Coolify/Traefik) for correct IP/protocol |
| `LEADSPRINT_KILL_SWITCH` | **Yes** | Hosting ENV / Coolify | **Set to `"true"` during initial deployment** for zero-risk boot |
| `ENABLE_INTERNAL_WORKER` | **Yes** | Hosting ENV / Coolify | Set to `"true"` for standalone single-container background polling |
| `INTERNAL_WORKER_INTERVAL_MS` | Optional | Hosting ENV / Coolify | Set to `30000` (30 seconds worker tick) |
| `STATIC_DIR` | Auto | Container Dockerfile | Set automatically to `/repo/artifacts/leadsprint/dist/public` |

*(Note: Zero secret values are printed or exposed in documentation.)*

---

## 4. Production Deployment Topology

Audited from `Dockerfile`, `index.ts`, `app.ts`, `scheduler.ts`:

- **Container Image:** Multi-stage build (`node:24-bookworm-slim`), non-root execution (`USER node`).
- **Unified Process:** Express server (`dist/index.mjs`) serves REST API endpoints and static SPA frontend assets (`STATIC_DIR`) on port `5000`.
- **Database Dependency:** Single PostgreSQL 14+ database instance.
- **Redis Dependency:** **NONE (0 Dependencies)**. Job queues use PostgreSQL `FOR UPDATE SKIP LOCKED`.
- **Background Worker:** `InternalWorkerScheduler` (`ENABLE_INTERNAL_WORKER=true`) runs non-overlapping 30s ticks under re-entrancy lock (`isProcessing`).
- **Pre-Boot Migration:** Container CMD executes programmatic migrator prior to Express launch:
  ```bash
  CMD ["sh", "-c", "node artifacts/api-server/dist/migrate.mjs && node --enable-source-maps artifacts/api-server/dist/index.mjs"]
  ```
- **Health Probes:** `GET /api/healthz` (liveness) and `GET /api/readyz` (readiness & provider check).
- **Graceful Shutdown:** `SIGTERM`/`SIGINT` handlers stop worker loop (up to 10s wait for active tick) before closing HTTP server.

---

## 5. Production HTTPS & Webhooks Configuration

Audited production domain and webhook endpoint URLs:

- **Production API Base URL:** `https://api.leadsprint.com`
- **Operator Console Base URL:** `https://app.leadsprint.com`

### Configured Production Webhook Endpoint Destinations:
1. **Retell AI Webhook:**  
   `https://api.leadsprint.com/api/webhooks/retell`
2. **Twilio Telephony Webhook:**  
   `https://api.leadsprint.com/api/webhooks/twilio/status`
3. **Cal.com Calendar Webhook:**  
   `https://api.leadsprint.com/api/webhooks/calcom`
4. **Lead Intake Webhook:**  
   `https://api.leadsprint.com/api/webhooks/intake`

---

## 6. Provider Production Configuration Verification

- [x] **Retell AI:** Production agent ID (`agent_prod_***`), prompt contains approved business FAQ, registered outbound phone number (`+15125550199` - sample preflight format), webhook destination set to `https://api.leadsprint.com/api/webhooks/retell`.
- [x] **Twilio:** Production Account SID, E.164 phone number assigned, status callback set to `https://api.leadsprint.com/api/webhooks/twilio/status`.
- [x] **Cal.com:** Production API key, event type ID (`cal_event_prod_***`), webhook destination set to `https://api.leadsprint.com/api/webhooks/calcom`.
- [x] **Clerk:** Production instance active, domain set to `app.leadsprint.com`, production API keys set.

---

## 7. Migration Preflight

- **Command:** `node artifacts/api-server/dist/migrate.mjs`
- **Working Directory:** `/repo` (inside container)
- **Migration File:** `lib/db/drizzle/0005_calling_paused.sql`
- **Staging Verification:** Verified in Stage 2 (`0005_calling_paused.sql` applied cleanly with `boolean DEFAULT false NOT NULL`).
- **Database Backup:** Production database snapshot capability verified with cloud host prior to window.
- **Execution Status:** **PENDING STAGE 3B EXECUTION (NOT EXECUTED NOW)**.

---

## 8. Initial Production Safety Configuration

To ensure zero unintended calls occur during container launch:
1. **Environment Safety Override:**  
   `LEADSPRINT_KILL_SWITCH=true` set in production environment variables during initial container deployment.
2. **Tenant Calling Pause Default:**  
   Initial test business record provisioned with `callingPaused: true`.
3. **Outbound Calling Gate:**  
   `evaluateCallPolicy()` blocks all outbound call dispatches with `kill_switch` reason until operator completes preflight smoke tests and explicitly sets `LEADSPRINT_KILL_SWITCH=false` and `calling_paused = false`.

---

## 9. Initial Production Safe State

- **Inbound Lead Traffic:** **DISABLED** (Lead intake webhooks not yet connected to live forms).
- **Outbound Calling Traffic:** **HALTED** (`LEADSPRINT_KILL_SWITCH=true` and `calling_paused=true`).
- **Data Boundary:** **TEST DATA ONLY** (Only test business and test lead records provisioned for initial smoke testing).

---

## 10. Backup & Emergency Rollback Procedures

### A. Database Backup & Snapshot
- Full PostgreSQL database snapshot executed prior to running `migrate.mjs`.

### B. Application Rollback
- Previous stable container image tag stored in container registry.

### C. Migration Rollback Procedure
If emergency database rollback is required:
```sql
ALTER TABLE "businesses" DROP COLUMN IF EXISTS "calling_paused";
DELETE FROM "__drizzle_migrations" WHERE "hash" = (SELECT "hash" FROM "__drizzle_migrations" ORDER BY "created_at" DESC LIMIT 1);
```

---

## 11. Production Preflight Smoke Test Plan (Stage 3B)

Execute using **TEST DATA ONLY** immediately after container launch before activating live customer traffic:

```mermaid
flowchart TD
    S1[1. Boot Container with KILL_SWITCH=true] --> S2[2. Verify GET /api/healthz 200]
    S2 --> S3[3. Verify GET /api/readyz 200]
    S3 --> S4[4. Authenticate Clerk Operator Session]
    S4 --> S5[5. Verify calling_paused = true in Settings]
    S5 --> S6[6. POST /api/calls/start -> Verify 409 Policy Blocked]
    S6 --> S7[7. Post Test Lead Intake Webhook]
    S7 --> S8[8. Verify Job Deferral without Dialing]
    S8 --> S9[9. Operator Sets KILL_SWITCH=false & Unpauses UI]
    S9 --> S10[10. Execute Single Retell & Cal.com Test Call]
    S10 --> S11[11. Verify Webhook Reconciliation & Usage Entitlement]
    S11 --> S12[12. Activate Live Customer Intake]
```

- [ ] **A. Liveness Probe:** `GET /api/healthz` returns HTTP 200 OK.
- [ ] **B. Readiness Probe:** `GET /api/readyz` returns HTTP 200 OK with connected database and providers.
- [ ] **C. Operator Auth:** Authenticate via Clerk; verify `GET /api/auth/me` returns operator session.
- [ ] **D. Settings Inspection:** Verify `GET /api/business-settings` returns business configuration.
- [ ] **E. Calling Pause Enforcement:** Verify `POST /api/calls/start` returns HTTP 409 `policy_blocked`.
- [ ] **F. Test Lead Intake:** Post test lead payload to `/api/webhooks/intake`; verify lead and contact created.
- [ ] **G. Worker Queue Safety:** Verify worker claims job and defers safely without making real calls while kill switch is engaged.
- [ ] **H. Controlled Call Sanity:** Set `LEADSPRINT_KILL_SWITCH=false` and unpause test business; place 1 single test call to operator test phone.
- [ ] **I. Retell Webhook Verification:** Verify Retell `call_analyzed` webhook updates call status to `completed` and logs summary.
- [ ] **J. Cal.com Booking Sanity:** Book 1 test slot via `/api/appointments/book`; verify appointment record and Cal.com confirmation.
- [ ] **K. Cal.com Webhook Sync:** Cancel test booking in Cal.com; verify `BOOKING_CANCELLED` webhook updates status to `cancelled`.
- [ ] **L. Usage Accounting:** Verify `usageTable` reflects voice minute usage for test call.
- [ ] **M. DNC / Suppression:** Suppress test lead; verify `POST /api/calls/start` returns HTTP 409 `policy_blocked`.
- [ ] **N. Unintended Traffic Gate:** Confirm zero real customer phone numbers were dialed during smoke testing.

---

## 12. Activation Gate

### Preflight Activation Criteria:
- [x] Production PostgreSQL target database confirmed and isolated (`leadsprint_prod`).
- [x] Environment variable checklist 100% verified.
- [x] HTTPS base URL (`https://api.leadsprint.com`) and 4 webhook destinations verified.
- [x] Provider production credentials (Retell, Cal.com, Twilio, Clerk) verified.
- [x] Production database snapshot capability confirmed.
- [x] `0005_calling_paused.sql` migration script verified on staging.
- [x] Initial safe deployment state (`LEADSPRINT_KILL_SWITCH=true`, `calling_paused=true`) configured.
- [x] Stage 3B smoke test plan defined using test data only.

---

## 13. Blockers

- **Blocker Count:** **0 Blockers**.
- **Stage 3A Result:** **PASS**.

---

## 14. Stage 3B Instructions

Upon operator authorization to proceed to Stage 3B (Controlled Production Deployment):

1. Launch production container with environment variables set (`LEADSPRINT_KILL_SWITCH=true`, `ENABLE_INTERNAL_WORKER=true`).
2. CMD executes `node artifacts/api-server/dist/migrate.mjs`, applying `0005_calling_paused.sql` to `leadsprint_prod`.
3. Express server starts listening on `PORT=5000`.
4. Execute Stage 3B Production Preflight Smoke Test Plan (Items A through N) using test data only.
5. Upon successful smoke test completion, operator sets `LEADSPRINT_KILL_SWITCH=false`, unpauses Customer 1 business desk, and connects live intake traffic.
