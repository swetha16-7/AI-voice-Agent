# Phase 4 — Real Customer #1 Intake & Verification Checklist

> **Document Type:** Operational Intake & Readiness Verification Checklist  
> **Target Tenant:** Real Customer #1 (First Production Commercial Pilot)  
> **Current Intake Status:** `REAL CUSTOMER #1 — WAITING FOR ACTUAL CUSTOMER INFORMATION`  
> **Safety State:** `LEADSPRINT_KILL_SWITCH=true` | `calling_paused=true` (Outbound Calling Disabled)  
> **Governing Standards:** [PHASE4_REAL_CUSTOMER_ONBOARDING_FORM.md](file:///c:/Users/Swetha/Downloads/LeadSprint-Boomi-main/LeadSprint-Boomi-main/docs/PHASE4_REAL_CUSTOMER_ONBOARDING_FORM.md), [PHASE4_STAGE4R_REAL_CUSTOMER_ONBOARDING.md](file:///c:/Users/Swetha/Downloads/LeadSprint-Boomi-main/LeadSprint-Boomi-main/docs/PHASE4_STAGE4R_REAL_CUSTOMER_ONBOARDING.md), [PHASE4_STAGE5_CUSTOMER1_GO_LIVE_RUNBOOK.md](file:///c:/Users/Swetha/Downloads/LeadSprint-Boomi-main/LeadSprint-Boomi-main/docs/PHASE4_STAGE5_CUSTOMER1_GO_LIVE_RUNBOOK.md)

---

## 1. Real Customer Identity

| Item / Field | Customer Provided Input | Internally Verified | Evidence / Reference | Verification Status |
| :--- | :--- | :---: | :--- | :---: |
| **Legal Business Name** | `[Pending Customer Input]` | [ ] | State corporate filing / Secretary of State | `[ ] PENDING` |
| **Operating / DBA Name** | `[Pending Customer Input]` | [ ] | Brand registration / website matching | `[ ] PENDING` |
| **Corporate Website** | `[Pending Customer Input]` | [ ] | Active HTTPS website & domain WHOIS | `[ ] PENDING` |
| **Physical Business Address** | `[Pending Customer Input]` | [ ] | US business address verification | `[ ] PENDING` |
| **Primary US State** | `[Pending Customer Input]` | [ ] | Jurisdiction jurisdiction match | `[ ] PENDING` |
| **Target Market / Cities Served** | `[Pending Customer Input]` | [ ] | Operating desk geographic bounds | `[ ] PENDING` |
| **Primary Business Contact** | `[Pending Customer Input]` | [ ] | Corporate officer confirmation | `[ ] PENDING` |
| **Customer Contact Information** | `[Pending Customer Input]` | [ ] | Direct executive email & phone | `[ ] PENDING` |

---

## 2. Authorized Operator

| Item / Field | Customer Provided Input | Internally Verified | Evidence / Reference | Verification Status |
| :--- | :--- | :---: | :--- | :---: |
| **Operator Full Name** | `[Pending Customer Input]` | [ ] | Identity confirmation | `[ ] PENDING` |
| **Operator Role / Title** | `[Pending Customer Input]` | [ ] | Corporate authorization role | `[ ] PENDING` |
| **Operator Business Email** | `[Pending Customer Input]` | [ ] | Clerk User provisioning & auth check | `[ ] PENDING` |
| **Operator Direct Phone** | `[Pending Customer Input]` | [ ] | Two-factor / direct communication test | `[ ] PENDING` |
| **Authorization Confirmation** | `[Pending Customer Input]` | [ ] | Signed Section 2 authorization statement | `[ ] PENDING` |
| **Approval Contact** | `[Pending Customer Input]` | [ ] | Contact channel for go-live sign-off | `[ ] PENDING` |

---

## 3. Telephony & Provider Configuration

> [!WARNING]
> **Never enter passwords, API secrets, auth tokens, or private keys into this document.**

| Item / Field | Customer Provided Input | Internally Verified | Evidence / Reference | Verification Status |
| :--- | :--- | :---: | :--- | :---: |
| **Telephony Provider** | `[Pending Customer Input]` | [ ] | Twilio / Retell Telephony carrier | `[ ] PENDING` |
| **Production Account Identifier** | `[Pending Customer Input]` | [ ] | Provider account SID / Org ID | `[ ] PENDING` |
| **Real Production Phone Number** | `[Pending Customer Input]` | [ ] | E.164 number formatted & validated | `[ ] PENDING` |
| **Phone Number Ownership** | `[Pending Customer Input]` | [ ] | Customer carrier proof / registration | `[ ] PENDING` |
| **Retell Production Agent ID** | `[Pending Customer Input]` | [ ] | Retell API agent verification | `[ ] PENDING` |
| **Retell Agent Version Tag** | `[Pending Customer Input]` | [ ] | Deployed prompt model version tag | `[ ] PENDING` |
| **Human Transfer Destination** | `[Pending Customer Input]` | [ ] | Test call to transfer number confirmed | `[ ] PENDING` |
| **Webhook Configuration** | `[Pending Customer Input]` | [ ] | `/api/webhooks/retell` & Twilio webhooks | `[ ] PENDING` |

---

## 4. Calendar & Scheduling Integration

| Item / Field | Customer Provided Input | Internally Verified | Evidence / Reference | Verification Status |
| :--- | :--- | :---: | :--- | :---: |
| **Calendar Provider** | `[Pending Customer Input]` | [ ] | Cal.com / Google / Outlook connection | `[ ] PENDING` |
| **Production Account / Host** | `[Pending Customer Input]` | [ ] | Cal.com account linkage | `[ ] PENDING` |
| **Production Calendar ID** | `[Pending Customer Input]` | [ ] | Target booking calendar verified | `[ ] PENDING` |
| **Cal.com Event Type ID** | `[Pending Customer Input]` | [ ] | Showing event type active in Cal.com | `[ ] PENDING` |
| **Appointment Duration** | `[Pending Customer Input]` | [ ] | Slot duration in minutes | `[ ] PENDING` |
| **Host Availability Schedule** | `[Pending Customer Input]` | [ ] | `/v2/slots` returns active available slots | `[ ] PENDING` |
| **Timezone Auto-Conversion** | `[Pending Customer Input]` | [ ] | Attendee timezone conversion confirmed | `[ ] PENDING` |
| **Calendar Webhooks** | `[Pending Customer Input]` | [ ] | `/api/webhooks/calcom` webhook registered | `[ ] PENDING` |

---

## 5. Lead Intake & Compliance Provenance

| Item / Field | Customer Provided Input | Internally Verified | Evidence / Reference | Verification Status |
| :--- | :--- | :---: | :--- | :---: |
| **Lead Source(s)** | `[Pending Customer Input]` | [ ] | Website form, Facebook Ad, CRM webhook | `[ ] PENDING` |
| **CRM / Source System** | `[Pending Customer Input]` | [ ] | Originating platform identity verified | `[ ] PENDING` |
| **Source Event ID Mapping** | `[Pending Customer Input]` | [ ] | Unique event ID for idempotency dedupe | `[ ] PENDING` |
| **Required Lead Fields** | `[Pending Customer Input]` | [ ] | First, Last, Phone, Property/Interest | `[ ] PENDING` |
| **TCPA Consent Evidence** | `[Pending Customer Input]` | [ ] | Timestamp, Source URL, IP, Disclosure | `[ ] PENDING` |
| **DNC / Suppression Source** | `[Pending Customer Input]` | [ ] | Internal CRM suppression / UI opt-out | `[ ] PENDING` |
| **Phone Normalization** | `[Pending Customer Input]` | [ ] | `libphonenumber-js` E.164 parsing | `[ ] PENDING` |
| **Recipient Timezone Provenance**| `[Pending Customer Input]` | [ ] | Area code / postal code mapping | `[ ] PENDING` |

---

## 6. Calling Policy & Guardrails

| Item / Field | Customer Specification | Software Enforcement Mechanism | Verification Status |
| :--- | :--- | :--- | :---: |
| **Business Calling Hours** | `[Pending Customer Input]` | `evaluateCallPolicy()` window check | `[ ] PENDING` |
| **Quiet Hours Window** | `21:00 to 08:00` (Default) | Dual-gate hard block (lead & business) | `[ ] PENDING` |
| **Calling Days** | `[Pending Customer Input]` | Day-of-week eligibility evaluation | `[ ] PENDING` |
| **Maximum Attempts** | `[Pending Customer Input]` (Max 2) | Attempt counter check in `contactsTable` | `[ ] PENDING` |
| **Retry Backoff Schedule** | `[Pending Customer Input]` (Default 30m)| `workflowJobsTable.availableAt` deferral | `[ ] PENDING` |
| **Transfer Triggers** | `[Pending Customer Input]` | Retell live SIP transfer condition | `[ ] PENDING` |
| **Handoff Fallback** | `[Pending Customer Input]` | Actionable callback task on Today desk | `[ ] PENDING` |
| **Tenant Calling Pause** | `[Pending Customer Input]` | `businessesTable.callingPaused` toggle | `[ ] PENDING` |

---

## 7. Voice Agent Scripting & Boundaries

| Item / Field | Customer Specification | Guardrail / Rule | Verification Status |
| :--- | :--- | :--- | :---: |
| **Agent Purpose** | `[Pending Customer Input]` | Inbound speed-to-lead qualification & showing booking | `[ ] PENDING` |
| **Greeting & Disclosure** | `[Pending Customer Input]` | Must include mandatory AI recorded-line disclosure | `[ ] PENDING` |
| **Qualification Questions** | `[Pending Customer Input]` | Structured questions (timeline, budget, location) | `[ ] PENDING` |
| **Allowed Information** | `[Pending Customer Input]` | Factual real-estate preferences (no invented intent scores) | `[ ] PENDING` |
| **Prohibited Information** | `[Pending Customer Input]` | Strict ban on SSNs, banking, health, or non-real-estate data | `[ ] PENDING` |
| **Handoff Conditions** | `[Pending Customer Input]` | Lead requests human or asks out-of-scope legal questions | `[ ] PENDING` |
| **Booking Behavior** | `[Pending Customer Input]` | Dynamic slot retrieval from Cal.com with attendee confirmation | `[ ] PENDING` |

---

## 8. Commercial Agreement

| Commercial Parameter | Pilot Terms | Agreement Status | Verification Reference |
| :--- | :--- | :---: | :--- |
| **One-Time Setup Fee** | **$500** | `[ ] Invoiced / Paid` | MVP Reference Specification (`POST_M6` line 269) |
| **Monthly Subscription Price** | **$399 / month baseline** | `[ ] Confirmed` | Core Pilot Subscription (`POST_M6` line 269) |
| **Included Voice Minutes** | **300 minutes / month** | `[ ] Initialized` | `businessesTable.includedVoiceMinutes = 300` |
| **Billing Model** | **Managed / Manual Invoice** | `[ ] Confirmed` | Direct monthly invoicing in arrears |
| **Stripe Self-Service** | **DEFERRED** | `[ ] Confirmed` | Self-serve credit card checkout deferred |
| **Optional Overage Rate** | **$0.20 / minute** *(Custom)* | `[ ] Optional / Explicit Approval Only` | Requires explicit commercial agreement; not default MVP |

---

## 9. Verification Summary Gate

Before proceeding to customer acceptance testing, the operations engineer must verify every item:

- [ ] **Customer Provided:** 100% of required fields collected from the customer without missing details.
- [ ] **Internally Verified:** All identities, corporate filings, provider accounts, and phone numbers validated.
- [ ] **Evidence / Reference Documented:** Exact URLs, account IDs, and timestamps recorded.
- [ ] **Verification Status:** All sections marked `VERIFIED`.

---

## 10. Explicit Customer Activation Approval Gate

> [!IMPORTANT]
> **CUSTOMER APPROVAL REQUIRED PRIOR TO ACTIVATION**  
> Technical readiness does NOT constitute authorization to enable outbound calling. Outbound calling must remain paused (`calling_paused = true`) until formal written approval is received in Section 12 of `docs/PHASE4_REAL_CUSTOMER_ONBOARDING_FORM.md`.

- [ ] **Form Sign-off Received:** Section 12 signed by authorized customer operator.
- [ ] **Signatory Identity Verified:** Approving contact matches verified Clerk user ID.
- [ ] **Timestamp Recorded:** Approval date/time documented in activation record.

---

## 11. Single-Lead Canary Execution Plan

Following explicit customer approval, the controlled canary must proceed strictly as follows:

1. **Canary Lead Selection:** Ingest **exactly one** customer-approved lead.
2. **Internal Scheduler Dispatch:** Dispatched exclusively via the normal production background worker loop (`ENABLE_INTERNAL_WORKER=true`). **Zero manual worker bypass.**
3. **Lifecycle Monitoring:** Observe state transitions (`created` &rarr; `queued` &rarr; `in_progress` &rarr; `completed`).
4. **Usage Accounting Audit:** Confirm call duration ledgered accurately against 300-minute baseline in `usageTable`.
5. **Audit Trail Verification:** Confirm structured audit log entry in `auditLogsTable`.
6. **Handoff Verification (If Triggered):** Verify live SIP transfer to operator phone.
7. **Booking Verification (If Triggered):** Verify appointment in `appointmentsTable` and Cal.com.
8. **Immediate Rollback Ready:** If any anomaly occurs, immediately toggle `calling_paused = true`.

---

## 12. Safety Blockers & Immediate Halt Triggers

The onboarding workflow must **STOP IMMEDIATELY** if any of the following conditions exist:

> [!CAUTION]
> **ONBOARDING HALT CONDITIONS:**
> 1. Customer business identity is unverified or ambiguous.
> 2. Authorized operator identity or Clerk authentication is unverified.
> 3. Phone number ownership or carrier registration is unverified.
> 4. Production provider IDs (Retell, Twilio, Cal.com) are missing or invalid.
> 5. Inbound TCPA affirmative consent evidence is missing or invalid.
> 6. Do-Not-Call (DNC) / suppression handling is unclear.
> 7. Recipient timezone provenance cannot be determined from phone/location.
> 8. Explicit customer approval for production activation has not been received.
> 9. Any supplied value appears synthetic, placeholder, or fabricated.
> 10. Passwords, API keys, webhook secrets, or private tokens are entered into onboarding documents.

---

## 13. Synthetic Data Strict Prohibition Rule

To ensure complete production integrity:

- **NEVER** use "Northstar Realty" or any derivative as a real customer.
- **NEVER** use RFC 2606 `.example` email addresses for production operators.
- **NEVER** use fictional 555-range numbers for production caller IDs or transfers.
- **NEVER** invent Retell agent IDs, Twilio SIDs, or Cal.com event IDs.
- **NEVER** infer or fabricate missing customer data, consent evidence, or timezones.

---

## 14. Final Customer Intake Status

```text
====================================================================
CUSTOMER INTAKE WORKFLOW STATUS
====================================================================
CURRENT STATUS:
REAL CUSTOMER #1 — WAITING FOR ACTUAL CUSTOMER INFORMATION

ACTIVE PRODUCTION SAFETY STATE:
- LEADSPRINT_KILL_SWITCH = true
- calling_paused = true (all customer desks)
- Real Customer Traffic = DISABLED
- Outbound Calling = DISABLED

Zero customer records provisioned. Zero outbound calls placed.
LeadSprint remains locked in a secure, production-safe holding state.
====================================================================
```
