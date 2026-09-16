# LeadSprint — Real Customer #1 Onboarding Form

> **Document Type:** Production Onboarding & Controlled Activation Specification Form  
> **Target Entity:** LeadSprint Pilot Customer #1  
> **Current Status:** `REAL CUSTOMER #1 NOT YET ONBOARDED`  
> **Safety State:** `LEADSPRINT_KILL_SWITCH=true` | `calling_paused=true` (Outbound Calling Disabled)  
> **Governing Standards:** [PHASE4_STAGE4R_REAL_CUSTOMER_ONBOARDING.md](file:///c:/Users/Swetha/Downloads/LeadSprint-Boomi-main/LeadSprint-Boomi-main/docs/PHASE4_STAGE4R_REAL_CUSTOMER_ONBOARDING.md)

---

## Instructions for Customer & Operator

- **Customer / Agency Representative:** Complete Sections 1 through 9. Complete Section 12 only when ready for formal production activation sign-off.
- **LeadSprint Operations Team:** Complete Sections 10, 11, 13, and 15 during verification and testing.
- **Security Notice:** *Never enter passwords, API secrets, auth tokens, or private keys into this document.* Provider credentials and secret tokens must be exchanged via approved secure channels (e.g., encrypted secret manager, secure operator session).

---

## 1. Customer / Business Information *(Customer Provided)*

Please provide the formal business details for the agency / brokerage tenant:

| Field | Description / Requirement | Customer Value |
| :--- | :--- | :--- |
| **Legal Business Name** | Registered entity name (LLC / Inc / Corp) | `________________________________________` |
| **Operating / DBA Name** | Consumer-facing brand / desk name | `________________________________________` |
| **Business Type** | Independent Brokerage / Franchise / Real Estate Team | `________________________________________` |
| **Business Website** | Primary corporate / agency domain URL | `https://________________________________` |
| **Business Address** | Street address, Suite, City, State, ZIP code | `________________________________________` |
| **Primary Operating Location** | City / Metro region where leads originate | `________________________________________` |
| **US State** | Primary US state of operation (e.g., TX, FL, CA) | `________________________________________` |
| **Market / Cities Served** | Specific metropolitan areas / counties covered | `________________________________________` |
| **Primary Business Contact** | Executive / General Manager name | `________________________________________` |
| **Contact Email** | Primary corporate email address | `________________________________________` |
| **Contact Phone** | Direct business phone number (E.164 format) | `+1 _____________________________________` |
| **Business Timezone** | Canonical IANA timezone (`America/New_York`, `America/Chicago`, `America/Denver`, `America/Los_Angeles`) | `________________________________________` |

---

## 2. Authorized Operator *(Customer Provided)*

Designate the primary operator who will access the LeadSprint console, manage day-to-day desk operations, and approve outbound calling activation:

| Field | Description / Requirement | Customer Value |
| :--- | :--- | :--- |
| **Operator Full Name** | First and Last Name | `________________________________________` |
| **Operator Role / Title** | Broker / Lead Manager / Operations Director | `________________________________________` |
| **Operator Business Email** | Corporate email address for Clerk authentication | `________________________________________` |
| **Operator Phone Number** | Direct phone number for operational communications | `+1 _____________________________________` |
| **Customer Authorization Date** | Date authorization was granted (YYYY-MM-DD) | `________________________________________` |
| **Activation Approval Contact** | Designated email / phone for go-live sign-off | `________________________________________` |

### Operator Authorization Confirmation:
> [ ] **"I confirm that I am authorized by the business to provide these configuration details and approve controlled production activation."**
>
> **Authorized Operator Signature:** `________________________________________`  
> **Date:** `____________________`

*(Note: Completion of this form alone does NOT constitute proof of activation authorization. Explicit customer sign-off in Section 12 is mandatory before outbound calling is unlocked.)*

---

## 3. Telephony / Voice Provider *(Customer Provided / Operator Verified)*

> [!WARNING]
> **Never enter passwords, API secrets, auth tokens, or private keys into this document.**

| Parameter | Specification / Requirement | Customer / Tenant Value |
| :--- | :--- | :--- |
| **Telephony Provider Name** | Twilio / Direct Carrier / Retell Telephony | `________________________________________` |
| **Production Account Identifier** | Provider Account SID / Organization ID | `________________________________________` |
| **Production Business Phone Number** | Real E.164 outbound caller ID (e.g., `+1XXXXXXXXXX`) | `+1 _____________________________________` |
| **Number Ownership Confirmation** | Number owned/controlled and registered to customer | `[ ] YES, owned/controlled` |
| **Voice Provider Connection Status** | Provider credentials bound via secure backend | `[ ] Bound and Active` |
| **Retell Production Agent ID** | Production Agent ID configured in Retell console | `agent___________________________________` |
| **Retell Production Agent Version** | Deployed prompt/agent version tag | `v______________________________________` |
| **Webhook Configuration Status** | Webhook URL set to `/api/webhooks/retell` | `[ ] Configured in Retell` |
| **Human Transfer Destination** | Live operator phone number for call escalations | `+1 _____________________________________` |
| **Transfer Ownership Confirmation** | Verified destination owned by authorized operator | `[ ] Verified & Authorized` |

---

## 4. Calendar / Scheduling *(Customer Provided)*

| Parameter | Specification / Requirement | Customer / Tenant Value |
| :--- | :--- | :--- |
| **Calendar Provider** | Cal.com / Google Calendar / Outlook (via Cal.com) | `________________________________________` |
| **Production Account / User** | Account username or primary host user ID | `________________________________________` |
| **Production Calendar Identifier** | Target calendar name / ID for showing appointments | `________________________________________` |
| **Cal.com Production Event Type ID** | Numeric / slug event type ID for bookings | `________________________________________` |
| **Appointment Duration** | Duration in minutes (e.g., 15m, 30m, 45m, 60m) | `__________ minutes` |
| **Available Booking Hours** | Operating window for showings (e.g., Mon–Fri 09:00–18:00) | `________________________________________` |
| **Buffer Rules** | Buffer time between appointments (e.g., 15 mins) | `__________ minutes` |
| **Attendee Timezone Behavior** | Auto-convert between attendee local time and host calendar | `[ ] Enabled (Auto-convert)` |
| **Cancellation / Reschedule Rules** | Minimum notice period required for rescheduling | `__________ hours` |
| **Webhook Configuration Status** | Webhook destination `/api/webhooks/calcom` registered | `[ ] Configured in Cal.com` |

---

## 5. Lead Intake *(Customer Provided)*

> [!IMPORTANT]
> **Do not invent consent, timezone, intent, qualification, lead source, or other customer data when the source does not provide it.**

| Parameter | Requirement / Description | Customer Value |
| :--- | :--- | :--- |
| **Lead Source(s)** | Agency Website Form / Facebook Lead Ads / Zillow / Realtor.com | `________________________________________` |
| **CRM / Source System** | Source system sending webhooks (e.g., Zapier, HubSpot, Custom) | `________________________________________` |
| **Intake Webhook / Source Identifier** | Configured source identifier string for payload routing | `________________________________________` |
| **Expected Event ID Format** | Format of unique source event ID (for deduplication) | `________________________________________` |
| **Lead Fields Provided** | List of all fields payload will supply | `________________________________________` |
| **Required Lead Fields** | First Name, Last Name, Phone, Email, Property of Interest | `________________________________________` |
| **Consent Information Source** | Form opt-in timestamp, source URL, IP, disclosure version | `________________________________________` |
| **Existing DNC / Suppression Source** | Internal CRM suppression list / opt-out database | `________________________________________` |
| **Contact Phone Number Format** | Source phone format (E.164, national 10-digit, formatted) | `________________________________________` |
| **Recipient Timezone / Location** | Does intake payload supply state / postal code / timezone? | `[ ] YES   [ ] NO (Derived from area code)` |

---

## 6. Calling Policy *(Customer Approved / System Enforced)*

LeadSprint enforces authoritative automated calling policy gates. The customer must configure operational boundaries within these legal and architectural constraints:

| Policy Dimension | Customer Specification | System Enforcement & Constraint |
| :--- | :--- | :--- |
| **Calling Days** | `[ ] Mon–Fri   [ ] Sat   [ ] Sun` | Enforced by `evaluateCallPolicy()` scheduler |
| **Business Calling Hours** | `____:____ to ____:____` (Local time) | Calling outside window automatically deferred |
| **Quiet Hours Window** | `21:00 to 08:00` (Default / Standard) | Mandatory hard block in lead AND business timezones |
| **Recipient Timezone Policy** | `[ ] Respect Lead Timezone   [ ] Dual-Gate` | Dual-gate: must be valid in both lead & desk timezones |
| **Maximum Call Attempts** | `__________` attempts (Default: 2) | Attempt counter tracked in `contactsTable` |
| **Retry / Defer Behavior** | `__________` minutes backoff (Default: 30m) | Handled by `workflowJobsTable` scheduling |
| **Human Transfer Triggers** | `[ ] Lead Requests Agent   [ ] High Budget` | Retell agent initiates live SIP transfer |
| **Human Handoff Fallback** | `[ ] Create callback task on Today desk` | Activity created when transfer does not connect |
| **DNC / Suppression Policy** | `[ ] Immediate one-click suppression` | Suppressed contacts return HTTP 409 `policy_blocked` |
| **Tenant Pause Expectations** | `[ ] Operator can pause dialing anytime` | Pause button on Settings desk halts all dispatches |

> [!NOTE]
> **Authoritative Policy Notice:** LeadSprint's built-in policy engine remains authoritative. Customer configuration cannot bypass affirmative TCPA consent, Do-Not-Call suppression, timezone provenance, quiet hours, voice minute entitlements, or global safety switches.

---

## 7. Voice Agent Configuration *(Customer Approved)*

Define the behavioral profile and script boundaries for the Retell voice assistant:

| Configuration Item | Customer-Approved Specification |
| :--- | :--- |
| **Agent Purpose** | Speed-to-lead qualification and showing appointment scheduling for inbound buyer/renter inquiries |
| **Greeting & Disclosure** | *"Hello, this is [Assistant Name] with [Agency Name] on a recorded line following up on your inquiry about [Property/Area]. Do you have a quick moment?"* |
| **Qualification Questions** | 1. `____________________________________________________________________________________`<br/>2. `____________________________________________________________________________________`<br/>3. `____________________________________________________________________________________` |
| **Allowed Information to Collect** | Timeline (e.g., < 90 days), preferred neighborhoods, budget range, pre-approval status, showing time preferences. *(Do not invent arbitrary intent/qualification scores).* |
| **Prohibited Information (Do NOT Collect)** | Social Security Numbers, credit card/banking details, detailed health data, or non-real-estate personal data. |
| **Handoff Conditions** | Lead requests human agent, expresses dissatisfaction, or asks complex legal/contract questions. |
| **Booking Behavior** | Offer 2 concrete showing time slots from Cal.com availability; confirm attendee email and phone upon selection. |
| **Escalation Behavior** | If live transfer fails to connect within 20s, apologize, confirm callback, and post callback task to Operator Console. |
| **Customer-Approved Agent Instructions** | `____________________________________________________________________________________`<br/>`____________________________________________________________________________________` |
| **Test Scenarios / Key Phrases** | 1. Scenario: Direct booking request &rarr; Verify slot offered.<br/>2. Scenario: Operator transfer request &rarr; Verify handoff triggered.<br/>3. Scenario: Opt-out request ("Stop calling") &rarr; Verify polite end and suppression. |

---

## 8. Commercial Configuration *(Customer & LeadSprint Operations)*

The commercial terms for the LeadSprint MVP Pilot are structured as follows:

| Commercial Component | Pilot Terms | Status |
| :--- | :--- | :--- |
| **One-Time Setup Fee** | **$500** (Onboarding, Retell prompt tuning, telephony binding) | `[ ] Invoiced   [ ] Paid` |
| **Monthly Subscription Fee** | **$399 / month** baseline | `[ ] Active Pilot Rate` |
| **Included Voice Entitlement** | **300 voice minutes / month** | Standard policy blocks dispatch at limit |
| **Optional Overage Agreement** | **$0.20 / minute** (Optional custom agreement) | Requires explicit commercial sign-off |
| **Billing Model** | **Managed / Manual Invoice Billing** (Direct ACH / Invoice) | Confirmed for Pilot Phase |
| **Stripe Self-Service** | **DEFERRED** (Automated credit card checkout deferred) | Explicitly deferred to post-pilot |
| **Billing Contact Name** | `________________________________________` | Primary billing contact |
| **Billing Email** | `________________________________________` | Invoice delivery email |
| **Pilot Agreement Status** | `[ ] Executed Agreement on File` | Contract signed date: `____________` |
| **Billing Start Date** | `____________________` (Go-Live Date) | Invoicing commencement |

---

## 9. Compliance & Customer Confirmations *(Customer Signed)*

The authorized customer representative must read and confirm each statement below:

> [ ] **1. Phone Number Ownership:** I confirm that our business legally owns or has authorized control over the dedicated phone number and caller ID provided for outbound communications.  
> [ ] **2. Lead Data Authorization:** I confirm that our business is legally authorized to collect, store, and process all lead contact details submitted to the LeadSprint platform.  
> [ ] **3. Affirmative Consent & Legal Basis:** I confirm that all leads submitted for outbound voice contact have provided express affirmative consent in accordance with the Telephone Consumer Protection Act (TCPA) and applicable state regulations.  
> [ ] **4. Telemarketing Compliance Responsibility:** I acknowledge that our business remains responsible for its underlying legal obligations regarding telemarketing, registration, DNC list maintenance, and commercial disclosures.  
> [ ] **5. Information Accuracy:** I confirm that all business, operator, telephony, and calendar details provided in this form are accurate, authentic, and complete.  
> [ ] **6. Synthetic / Test Data Ban:** I understand that placeholder, sample, or fabricated data (such as `.example` domains or `555` numbers) must never be used for real customer production activation.  
> [ ] **7. Explicit Production Activation Requirement:** I understand that submitting this form does not automatically activate outbound calling, and that explicit written authorization in Section 12 is required prior to go-live.

**Authorized Representative Name:** `________________________________________`  
**Title:** `________________________________________`  
**Date:** `____________________`

---

## 10. Provider Verification Checklist *(Internal LeadSprint Operations)*

*This section must be completed and signed by the LeadSprint Operations Engineer prior to scheduling acceptance tests:*

- [ ] **Business Identity Verified:** Legal entity, state registration, and corporate domain ownership confirmed.
- [ ] **Authorized Operator Verified:** Clerk user account provisioned, authenticated, and verified.
- [ ] **Production Retell Account Verified:** Retell organization ID and production API connection verified.
- [ ] **Production Retell Agent Verified:** Production Agent ID, version tag, and customer prompt verified.
- [ ] **Production Business Phone Verified:** Real E.164 number provisioned and bound to tenant.
- [ ] **Transfer Destination Verified:** Human transfer destination dialed and confirmed operational.
- [ ] **Twilio / Telephony Configuration Verified:** Status callback webhooks configured and responding with HTTP 200.
- [ ] **Cal.com Production Configuration Verified:** Cal.com API connection and calendar link verified.
- [ ] **Calendar Event Type Verified:** Event Type ID verified with active slot availability.
- [ ] **Webhook Signatures / Configuration Verified:** HMAC webhook signature secrets registered in environment.
- [ ] **Lead Source Verified:** Inbound intake source URL and payload schema mapped.
- [ ] **Consent Evidence Verified:** Inbound payload verified to contain consent timestamp, source URL, and IP.
- [ ] **DNC / Suppression Source Verified:** Suppression mechanism and opt-out UI verified functional.
- [ ] **Timezone Provenance Verified:** Area code and postal code timezone mapping verified.
- [ ] **Calling Hours Verified:** Business hours and quiet hours (`21:00–08:00`) configured in tenant settings.
- [ ] **Usage Entitlement Configured:** 300 voice minutes initialized in active `usageTable` row.
- [ ] **Customer Acceptance Tests Completed:** 15/15 test cases executed and passed with test data.
- [ ] **Customer Explicitly Approved Activation:** Signed Section 12 received from authorized operator.

**Verifying LeadSprint Engineer:** `________________________________________`  
**Verification Date:** `____________________`

---

## 11. Customer Acceptance Test Plan *(Pre-Activation Verification)*

Prior to live customer traffic, the following controlled 15-step test sequence is executed using customer-approved test data:

1. **Test Lead Ingestion:** Post customer-approved test payload to `POST /api/webhooks/intake`. Confirm atomic insertion in `contactsTable`, `leadsTable`, and `workflowJobsTable`.
2. **Consent Evidence Verification:** Verify consent timestamp, source URL, IP, and disclosure version stored in `contactsTable`.
3. **Phone Normalization:** Verify `libphonenumber-js` normalizes test phone to standard E.164 format.
4. **Recipient Timezone Provenance:** Verify recipient timezone correctly identified from area code / postal code.
5. **Policy Decision Check:** Execute `evaluateCallPolicy()`; confirm policy evaluates to `eligible` (or `deferred` if outside hours).
6. **Queued Outbound Job Check:** Confirm workflow job is created in state `queued`.
7. **Tenant Pause Lock Check:** Confirm that while `calling_paused = true`, the background worker does NOT dispatch the call and defers safely.
8. **Explicit Activation Authorization Check:** Verify that Section 12 is formally signed before proceeding to canary call.
9. **Controlled Canary Lead:** Ingest exactly ONE controlled live test lead for the canary test.
10. **Retell Call Lifecycle:** Observe call transition (`queued` &rarr; `dispatching` &rarr; `in_progress` &rarr; `completed`).
11. **Transfer / Handoff Test:** Trigger test transfer condition; verify call routes successfully to human transfer destination.
12. **Booking Test:** Select test slot during call; confirm appointment record in `appointmentsTable` and Cal.com.
13. **Usage Accounting Check:** Confirm call duration is rounded and ledgered accurately against the 300-minute baseline in `usageTable`.
14. **Audit Trail Verification:** Verify structured audit log entry created in `auditLogsTable`.
15. **Duplicate Protection Check:** Confirm 1:1 ratio between intake lead and outbound call (zero duplicate dispatches).

> [!NOTE]
> The single-lead canary test must use a customer-approved test or live contact, and must **NEVER** occur before explicit production activation approval in Section 12.

---

## 12. Production Activation Approval *(Customer Approval Required)*

> [!IMPORTANT]
> **CUSTOMER APPROVAL REQUIRED BEFORE OUTBOUND CALLING IS ENABLED**  
> Do not claim authorization until this section is actually completed and signed by the authorized customer operator.

The customer hereby confirms:
1. All configuration details in this document have been reviewed and approved.
2. Third-party provider bindings (Retell, Twilio, Cal.com) have been verified.
3. Customer acceptance test results have been reviewed and accepted.
4. **The customer formally authorizes LeadSprint to initiate controlled production activation.**
5. The customer understands the first production call will be monitored as a single-lead canary.
6. The customer understands that outbound calling can be paused immediately at any time via the Operator Console.

| Approval Field | Customer Input |
| :--- | :--- |
| **Authorized Customer Name** | `________________________________________` |
| **Role / Title** | `________________________________________` |
| **Customer Email** | `________________________________________` |
| **Approval Date & Time** | `YYYY-MM-DD HH:MM (Timezone)` |
| **Approval Method** | `[ ] Written Email   [ ] Signed Form   [ ] Recorded Video Conference` |
| **Signature / Confirmation** | `________________________________________` |

---

## 13. Internal Activation Record *(LeadSprint Operations)*

*To be recorded by the operations engineer at the exact time of production activation:*

| Record Field | Operational Value |
| :--- | :--- |
| **Tenant / Business ID** | `biz____________________________________` |
| **Operator User ID** | `user___________________________________` |
| **Production Phone Number** | `+1 ____________________________________` |
| **Retell Agent ID & Version** | `agent___________________ / v__________` |
| **Calendar Event Type ID** | `_______________________________________` |
| **Lead Source Identifier** | `_______________________________________` |
| **Activation Timestamp** | `YYYY-MM-DD HH:MM:SS UTC` |
| **Activating Engineer Name** | `_______________________________________` |
| **Previous Safety State** | `calling_paused = true` | `LEADSPRINT_KILL_SWITCH = true` |
| **New Tenant Calling State** | `calling_paused = false` *(Specific to this tenant only)* |
| **Global Kill Switch State** | `LEADSPRINT_KILL_SWITCH = true` *(Unless dispatch engine requires false)* |
| **Canary Call Result** | `[ ] SUCCESSFUL (Call ID: retell________________)` |
| **Rollback Status** | `[ ] NO ROLLBACK NEEDED   [ ] ROLLED BACK (Reason: ____________)` |

---

## 14. Safety Rules & Operational Constraints

All personnel handling customer onboarding and activation must strictly obey these mandatory rules:

> [!CAUTION]
> 1. **NO Fabricated Information:** Never substitute fictional or sample values for missing customer details.
> 2. **NO .example Domains:** Never use `.example` or placeholder email addresses for production tenants.
> 3. **NO 555 Numbers:** Never use fictional 555-range numbers for production caller IDs or transfers.
> 4. **NO Fabricated Provider IDs:** Never invent Retell agent IDs, Twilio SIDs, or Cal.com event IDs.
> 5. **NO Assumed Authorization:** Never invent or assume customer authorization. Formal sign-off in Section 12 is mandatory.
> 6. **NO Unverified Activation:** Never activate outbound calling based solely on an internal checklist without customer sign-off.
> 7. **NO Unnecessary Kill Switch Changes:** Never disable the global kill switch merely because onboarding is complete. Prefer enabling only the approved customer tenant (`calling_paused = false`) while keeping unrelated tenants paused.
> 8. **NO Policy Bypasses:** Never bypass policy gates (consent, quiet hours, DNC suppression, usage limits).
> 9. **NO Secret Exposure:** Never enter or expose API keys, webhook secrets, passwords, or tokens in this document.
> 10. **STOP on Ambiguity:** If any required production detail is missing, inconsistent, or ambiguous, stop activation immediately and resolve it first.

---

## 15. Onboarding Status

### Tracking Stages:
- [ ] **Information Requested**
- [ ] **Information Received**
- [ ] **Identity Verified**
- [ ] **Provider Verification Complete**
- [ ] **Customer Acceptance Testing Complete**
- [ ] **Customer Approval Received**
- [ ] **Controlled Canary Approved**
- [ ] **Production Activation Complete**

```text
====================================================================
CURRENT DEFAULT ONBOARDING STATUS
====================================================================
STATUS:
REAL CUSTOMER #1 NOT YET ONBOARDED

PRODUCTION STATE:
LEADSPRINT_KILL_SWITCH = true
calling_paused = true (all desks)
Outbound calling DISABLED
Real customer traffic DISABLED
====================================================================
```

> **Safety Assurance:**  
> *Until an actual customer completes the required onboarding and explicitly approves activation, LeadSprint remains in production-safe paused state.*
