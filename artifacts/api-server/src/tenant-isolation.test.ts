import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import supertest from "supertest";
import leadsprintRouter from "./routes/leadsprint";
import { requireAuth } from "./middlewares/auth";

// In-memory mock database store for multi-tenant isolation testing
interface UserRecord {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: string;
}

interface BusinessRecord {
  id: string;
  name: string;
  market: "US" | "IN";
  timezone: string;
  phoneNumber: string;
  transferNumber: string;
  recordingDisclosure: boolean;
  aiDisclosure: boolean;
  quietHours: string;
  maxCallAttempts: number;
  suppressionEnabled: boolean;
  projectName: string;
  servicesOrPropertyTypes: string[];
  approvedFaq: string;
  qualificationQuestions: string[];
  escalationRules: string;
  calEventTypeId?: string | null;
  retellAgentId?: string | null;
  includedVoiceMinutes: number;
  callingPaused: boolean;
}

interface ContactRecord {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email: string | null;
  preferredLanguage: string;
  consentStatus: string;
  suppressedAt: Date | null;
  consentCapturedAt: Date | null;
  consentSource: string | null;
  consentDisclosureVersion: string | null;
  recipientTimezone: string | null;
  timezoneProvenance: string;
}

interface LeadRecord {
  id: string;
  businessId: string;
  contactId: string;
  source: string;
  campaign: string;
  project: string;
  propertyType: string;
  budgetMin: string | null;
  budgetMax: string | null;
  budgetLabel: string;
  location: string;
  timeline: string;
  qualificationStatus: string;
  intentScore: number;
  score: string;
  nextAction: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

interface CallRecord {
  id: string;
  businessId: string;
  contactId: string;
  leadId: string;
  provider: string;
  idempotencyKey: string;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number | null;
  summary: string;
  outcome: string;
  transferred: boolean;
  booked: boolean;
  errorState: string | null;
  createdAt: Date;
}

interface AppointmentRecord {
  id: string;
  businessId: string;
  contactId: string;
  leadId: string;
  serviceOrProperty: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  calendarProvider: string;
  externalId: string;
  status: string;
}

interface ActivityRecord {
  id: string;
  businessId: string;
  type: string;
  title: string;
  detail: string;
  createdAt: Date;
}

let usersStore: UserRecord[] = [];
let businessesStore: BusinessRecord[] = [];
let contactsStore: ContactRecord[] = [];
let leadsStore: LeadRecord[] = [];
let callsStore: CallRecord[] = [];
let appointmentsStore: AppointmentRecord[] = [];
let activitiesStore: ActivityRecord[] = [];

function extractVals(obj: any): any[] {
  const values: any[] = [];
  if (!obj) return values;
  if ("value" in obj && obj.value !== undefined) values.push(obj.value);
  if (Array.isArray(obj.queryChunks)) {
    for (const chunk of obj.queryChunks) {
      values.push(...extractVals(chunk));
    }
  }
  return values;
}

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    db: {
      select: (_fields?: any) => ({
        from: (table: any) => ({
          innerJoin: (joinTable: any, _condition: any) => ({
            where: (condition: any) => {
              const vals = extractVals(condition);
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              const specificId = vals.find((v) => typeof v === "string" && !v.startsWith("business_"));

              let rows: any[] = [];
              if (table === actual.leadsTable && joinTable === actual.contactsTable) {
                rows = leadsStore
                  .filter((l) => (!bizId || l.businessId === bizId) && (!specificId || l.id === specificId))
                  .map((lead) => {
                    const contact = contactsStore.find((c) => c.id === lead.contactId);
                    return { lead, contact };
                  });
              }
              const promise = Promise.resolve(rows);
              (promise as any).orderBy = () => promise;
              (promise as any).limit = (n: number) => Promise.resolve(rows.slice(0, n));
              return promise;
            },
          }),
          where: (condition: any) => {
            const vals = extractVals(condition);
            let result: any[] = [];
            if (table === actual.usersTable) {
              result = usersStore.filter((u) => vals.includes(u.id) || vals.includes(u.businessId));
            } else if (table === actual.businessesTable) {
              result = businessesStore.filter((b) => vals.includes(b.id));
            } else if (table === actual.leadsTable) {
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              result = leadsStore.filter((l) => !bizId || l.businessId === bizId);
            } else if (table === actual.callsTable) {
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              const specificId = vals.find((v) => typeof v === "string" && (v.startsWith("call_") || v.startsWith("lead_")));
              result = callsStore.filter(
                (c) => (!bizId || c.businessId === bizId) && (!specificId || c.id === specificId || c.leadId === specificId),
              );
            } else if (table === actual.appointmentsTable) {
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              result = appointmentsStore.filter((a) => !bizId || a.businessId === bizId);
            } else if (table === actual.contactsTable) {
              result = contactsStore.filter((c) => vals.includes(c.id));
            } else if (table === actual.activitiesTable) {
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              result = activitiesStore.filter((a) => !bizId || a.businessId === bizId);
            }

            const promise = Promise.resolve(result);
            (promise as any).orderBy = () => promise;
            (promise as any).limit = (n: number) => Promise.resolve(result.slice(0, n));
            return promise;
          },
        }),
      }),
      update: (table: any) => ({
        set: (values: any) => ({
          where: (condition: any) => ({
            returning: () => {
              const vals = extractVals(condition);
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              const specificId = vals.find((v) => typeof v === "string" && !v.startsWith("business_"));

              if (table === actual.businessesTable) {
                const b = businessesStore.find((x) => x.id === bizId);
                if (b) {
                  Object.assign(b, values);
                  return Promise.resolve([b]);
                }
              } else if (table === actual.leadsTable) {
                const l = leadsStore.find((x) => x.id === specificId && (!bizId || x.businessId === bizId));
                if (l) {
                  Object.assign(l, values);
                  return Promise.resolve([l]);
                }
              }
              return Promise.resolve([]);
            },
          }),
        }),
      }),
      insert: (table: any) => ({
        values: (item: any) => ({
          returning: () => Promise.resolve([item]),
          onConflictDoNothing: () => ({
            returning: () => Promise.resolve([item]),
          }),
        }),
      }),
      transaction: async (cb: any) => cb({
        select: (_fields?: any) => ({
          from: (table: any) => ({
            where: (condition: any) => {
              const vals = extractVals(condition);
              let result: any[] = [];
              if (table === actual.usersTable) {
                result = usersStore.filter((u) => vals.includes(u.id));
              } else if (table === actual.businessesTable) {
                result = businessesStore.filter((b) => vals.includes(b.id));
              }
              const promise = Promise.resolve(result);
              (promise as any).limit = (n: number) => Promise.resolve(result.slice(0, n));
              return promise;
            },
          }),
        }),
        insert: (table: any) => ({
          values: (item: any) => ({
            onConflictDoNothing: () => ({
              returning: () => {
                if (table === actual.businessesTable) businessesStore.push(item);
                if (table === actual.usersTable) usersStore.push(item);
                return Promise.resolve([item]);
              },
            }),
            returning: () => {
              if (table === actual.businessesTable) businessesStore.push(item);
              if (table === actual.usersTable) usersStore.push(item);
              return Promise.resolve([item]);
            },
          }),
        }),
        update: (_table: any) => ({
          set: (_vals: any) => ({
            where: (_cond: any) => ({
              returning: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    },
  };
});

vi.mock("./lib/usage", () => ({
  getActiveUsageRow: vi.fn().mockResolvedValue({
    id: "usage_test",
    businessId: "test",
    voiceMinutes: 0,
    smsCount: 0,
    bookingCount: 0,
    estimatedCost: 0,
  }),
  getBillingPeriod: vi.fn().mockReturnValue({
    periodLabel: "October 2026",
    periodStart: new Date("2026-10-01"),
    periodEnd: new Date("2026-10-31"),
  }),
}));

describe("Multi-Tenant & Authenticated User Isolation", () => {
  const userA = {
    userId: "user_clerk_A",
    businessId: "business_user_clerk_A",
    name: "Alice Owner",
    email: "alice@example.com",
  };

  const userB = {
    userId: "user_clerk_B",
    businessId: "business_user_clerk_B",
    name: "Bob Operator",
    email: "bob@example.com",
  };

  function createTestApp(authHeaderUser?: { userId: string; businessId: string }) {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      if (authHeaderUser) {
        req.leadSprintUserId = authHeaderUser.userId;
        req.leadSprintBusinessId = authHeaderUser.businessId;
        next();
      } else {
        res.status(401).json({ error: "Authentication required" });
      }
    });
    app.use("/api", leadsprintRouter);
    return app;
  }

  beforeEach(() => {
    usersStore = [
      { id: userA.userId, businessId: userA.businessId, name: userA.name, email: userA.email, role: "owner" },
      { id: userB.userId, businessId: userB.businessId, name: userB.name, email: userB.email, role: "operator" },
    ];

    businessesStore = [
      {
        id: userA.businessId,
        name: "Alice Real Estate",
        market: "US",
        timezone: "America/New_York",
        phoneNumber: "+12125550111",
        transferNumber: "+12125550199",
        recordingDisclosure: true,
        aiDisclosure: true,
        quietHours: "21:00–08:00",
        maxCallAttempts: 2,
        suppressionEnabled: true,
        projectName: "Alice Skyline Condos",
        servicesOrPropertyTypes: ["Condo"],
        approvedFaq: "Alice FAQ",
        qualificationQuestions: ["Budget?"],
        escalationRules: "Transfer to Alice",
        includedVoiceMinutes: 300,
        callingPaused: false,
      },
      {
        id: userB.businessId,
        name: "Bob Properties",
        market: "IN",
        timezone: "Asia/Kolkata",
        phoneNumber: "+91805550111",
        transferNumber: "+91805550199",
        recordingDisclosure: true,
        aiDisclosure: true,
        quietHours: "20:00–08:00",
        maxCallAttempts: 3,
        suppressionEnabled: true,
        projectName: "Bob Greenfield Plots",
        servicesOrPropertyTypes: ["Plot"],
        approvedFaq: "Bob FAQ",
        qualificationQuestions: ["Location?"],
        escalationRules: "Transfer to Bob",
        includedVoiceMinutes: 300,
        callingPaused: true,
      },
    ];

    contactsStore = [
      {
        id: "contact_A",
        businessId: userA.businessId,
        name: "Lead Alpha",
        phone: "+12125551000",
        email: "alpha@example.com",
        preferredLanguage: "en",
        consentStatus: "valid",
        suppressedAt: null,
        consentCapturedAt: new Date("2026-10-01"),
        consentSource: "web_form",
        consentDisclosureVersion: "v1",
        recipientTimezone: "America/New_York",
        timezoneProvenance: "explicit_intake",
      },
      {
        id: "contact_B",
        businessId: userB.businessId,
        name: "Lead Beta",
        phone: "+91805552000",
        email: "beta@example.com",
        preferredLanguage: "en",
        consentStatus: "valid",
        suppressedAt: null,
        consentCapturedAt: new Date("2026-10-01"),
        consentSource: "web_form",
        consentDisclosureVersion: "v1",
        recipientTimezone: "Asia/Kolkata",
        timezoneProvenance: "explicit_intake",
      },
    ];

    leadsStore = [
      {
        id: "lead_A",
        businessId: userA.businessId,
        contactId: "contact_A",
        source: "web",
        campaign: "CampA",
        project: "Alice Skyline Condos",
        propertyType: "Condo",
        budgetMin: "500000",
        budgetMax: "1000000",
        budgetLabel: "$500k - $1M",
        location: "Manhattan",
        timeline: "Immediate",
        qualificationStatus: "New",
        intentScore: 85,
        score: "hot",
        nextAction: "Call lead",
        status: "new",
        createdAt: new Date("2026-10-01T10:00:00Z"),
        updatedAt: new Date("2026-10-01T10:00:00Z"),
      },
      {
        id: "lead_B",
        businessId: userB.businessId,
        contactId: "contact_B",
        source: "referral",
        campaign: "CampB",
        project: "Bob Greenfield Plots",
        propertyType: "Plot",
        budgetMin: "2000000",
        budgetMax: "5000000",
        budgetLabel: "₹20L - ₹50L",
        location: "Bangalore",
        timeline: "3 months",
        qualificationStatus: "Reviewed",
        intentScore: 40,
        score: "cold",
        nextAction: "Review lead",
        status: "new",
        createdAt: new Date("2026-10-02T10:00:00Z"),
        updatedAt: new Date("2026-10-02T10:00:00Z"),
      },
    ];

    callsStore = [
      {
        id: "call_A",
        businessId: userA.businessId,
        contactId: "contact_A",
        leadId: "lead_A",
        provider: "Retell",
        idempotencyKey: "call_A_key",
        status: "completed",
        startedAt: new Date("2026-10-01T10:05:00Z"),
        endedAt: new Date("2026-10-01T10:08:00Z"),
        durationSeconds: 180,
        summary: "Alice client connected",
        outcome: "Qualified",
        transferred: false,
        booked: true,
        errorState: null,
        createdAt: new Date("2026-10-01T10:05:00Z"),
      },
      {
        id: "call_B",
        businessId: userB.businessId,
        contactId: "contact_B",
        leadId: "lead_B",
        provider: "Retell",
        idempotencyKey: "call_B_key",
        status: "queued",
        startedAt: null,
        endedAt: null,
        durationSeconds: null,
        summary: "Bob client queued",
        outcome: "Queued",
        transferred: false,
        booked: false,
        errorState: null,
        createdAt: new Date("2026-10-02T10:05:00Z"),
      },
    ];

    appointmentsStore = [
      {
        id: "appt_A",
        businessId: userA.businessId,
        contactId: "contact_A",
        leadId: "lead_A",
        serviceOrProperty: "Alice Skyline Condos",
        startTime: new Date("2026-10-10T14:00:00Z"),
        endTime: new Date("2026-10-10T14:30:00Z"),
        timezone: "America/New_York",
        calendarProvider: "Cal.com",
        externalId: "cal_ext_A",
        status: "confirmed",
      },
      {
        id: "appt_B",
        businessId: userB.businessId,
        contactId: "contact_B",
        leadId: "lead_B",
        serviceOrProperty: "Bob Greenfield Plots",
        startTime: new Date("2026-10-11T10:00:00Z"),
        endTime: new Date("2026-10-11T10:30:00Z"),
        timezone: "Asia/Kolkata",
        calendarProvider: "Cal.com",
        externalId: "cal_ext_B",
        status: "confirmed",
      },
    ];

    activitiesStore = [
      {
        id: "act_A",
        businessId: userA.businessId,
        type: "lead",
        title: "New lead for Alice",
        detail: "Lead Alpha arrived",
        createdAt: new Date("2026-10-01T10:00:00Z"),
      },
      {
        id: "act_B",
        businessId: userB.businessId,
        type: "lead",
        title: "New lead for Bob",
        detail: "Lead Beta arrived",
        createdAt: new Date("2026-10-02T10:00:00Z"),
      },
    ];
  });

  it("TEST 1: User A signs in and accesses only User A's business, settings, leads, calls, and appointments", async () => {
    const app = createTestApp(userA);

    // 1. GET /api/auth/me
    const meRes = await supertest(app).get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(userA.userId);
    expect(meRes.body.business.id).toBe(userA.businessId);
    expect(meRes.body.business.name).toBe("Alice Real Estate");

    // 2. GET /api/business-settings
    const settingsRes = await supertest(app).get("/api/business-settings");
    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.id).toBe(userA.businessId);
    expect(settingsRes.body.project_name).toBe("Alice Skyline Condos");

    // 3. GET /api/leads
    const leadsRes = await supertest(app).get("/api/leads");
    expect(leadsRes.status).toBe(200);
    expect(leadsRes.body).toHaveLength(1);
    expect(leadsRes.body[0].id).toBe("lead_A");
    expect(leadsRes.body[0].name).toBe("Lead Alpha");

    // 4. GET /api/calls
    const callsRes = await supertest(app).get("/api/calls");
    expect(callsRes.status).toBe(200);
    expect(callsRes.body).toHaveLength(1);
    expect(callsRes.body[0].id).toBe("call_A");
    expect(callsRes.body[0].summary).toBe("Alice client connected");

    // 5. GET /api/appointments
    const apptsRes = await supertest(app).get("/api/appointments");
    expect(apptsRes.status).toBe(200);
    expect(apptsRes.body).toHaveLength(1);
    expect(apptsRes.body[0].id).toBe("appt_A");
  });

  it("TEST 2: User B signs in and does NOT see User A's data", async () => {
    const app = createTestApp(userB);

    // 1. GET /api/auth/me
    const meRes = await supertest(app).get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.id).toBe(userB.userId);
    expect(meRes.body.business.id).toBe(userB.businessId);
    expect(meRes.body.business.name).toBe("Bob Properties");

    // 2. GET /api/leads - User B must NOT see lead_A
    const leadsRes = await supertest(app).get("/api/leads");
    expect(leadsRes.status).toBe(200);
    expect(leadsRes.body).toHaveLength(1);
    expect(leadsRes.body[0].id).toBe("lead_B");
    expect(leadsRes.body.some((l: any) => l.id === "lead_A")).toBe(false);

    // 3. GET /api/calls - User B must NOT see call_A
    const callsRes = await supertest(app).get("/api/calls");
    expect(callsRes.status).toBe(200);
    expect(callsRes.body).toHaveLength(1);
    expect(callsRes.body[0].id).toBe("call_B");
    expect(callsRes.body.some((c: any) => c.id === "call_A")).toBe(false);

    // 4. GET /api/appointments - User B must NOT see appt_A
    const apptsRes = await supertest(app).get("/api/appointments");
    expect(apptsRes.status).toBe(200);
    expect(apptsRes.body).toHaveLength(1);
    expect(apptsRes.body[0].id).toBe("appt_B");
    expect(apptsRes.body.some((a: any) => a.id === "appt_A")).toBe(false);

    // 5. GET /api/business-settings - User B gets only Bob Properties
    const settingsRes = await supertest(app).get("/api/business-settings");
    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.id).toBe(userB.businessId);
    expect(settingsRes.body.project_name).toBe("Bob Greenfield Plots");
  });

  it("TEST 3: A newly created Clerk user with a fresh workspace does NOT receive dummy/seeded data", async () => {
    const newUser = {
      userId: "user_clerk_fresh_999",
      businessId: "business_user_clerk_fresh_999",
    };

    usersStore.push({
      id: newUser.userId,
      businessId: newUser.businessId,
      name: "New Operator",
      email: "new@example.com",
      role: "owner",
    });

    businessesStore.push({
      id: newUser.businessId,
      name: "New LeadSprint workspace",
      market: "US",
      timezone: "America/New_York",
      phoneNumber: "",
      transferNumber: "",
      recordingDisclosure: true,
      aiDisclosure: true,
      quietHours: "21:00–08:00",
      maxCallAttempts: 2,
      suppressionEnabled: true,
      projectName: "Configure your first campaign",
      servicesOrPropertyTypes: [],
      approvedFaq: "",
      qualificationQuestions: [],
      escalationRules: "Transfer questions outside approved business information to a human.",
      includedVoiceMinutes: 300,
      callingPaused: false,
    });

    const app = createTestApp(newUser);

    // 1. GET /api/auth/me returns new user's own business
    const meRes = await supertest(app).get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.business.id).toBe(newUser.businessId);
    expect(meRes.body.business.name).toBe("New LeadSprint workspace");

    // 2. GET /api/leads is empty (0 records, no seeded leads)
    const leadsRes = await supertest(app).get("/api/leads");
    expect(leadsRes.status).toBe(200);
    expect(leadsRes.body).toEqual([]);

    // 3. GET /api/calls is empty (0 records, no seeded calls)
    const callsRes = await supertest(app).get("/api/calls");
    expect(callsRes.status).toBe(200);
    expect(callsRes.body).toEqual([]);

    // 4. GET /api/appointments is empty (0 records, no seeded appointments)
    const apptsRes = await supertest(app).get("/api/appointments");
    expect(apptsRes.status).toBe(200);
    expect(apptsRes.body).toEqual([]);
  });

  it("TEST 4: Changing a business/lead/call ID in an API request cannot expose or mutate another user's record", async () => {
    // Authenticated as User B
    const app = createTestApp(userB);

    // 1. Attempting to fetch User A's lead (`lead_A`) as User B returns 404
    const leadDetailRes = await supertest(app).get("/api/leads/lead_A");
    expect(leadDetailRes.status).toBe(404);
    expect(leadDetailRes.body.error).toContain("Lead not found");

    // 2. Attempting to patch User A's lead (`lead_A`) as User B returns 404
    const patchLeadRes = await supertest(app)
      .patch("/api/leads/lead_A")
      .send({ status: "contacted", next_action: "Hacked" });
    expect(patchLeadRes.status).toBe(404);

    // 3. Attempting to view User A's call (`call_A`) as User B returns 404
    const callDetailRes = await supertest(app).get("/api/calls/call_A");
    expect(callDetailRes.status).toBe(404);
    expect(callDetailRes.body.error).toContain("Call not found");
  });

  it("TEST 5: Unauthenticated requests remain unauthorized (401)", async () => {
    // Request with no auth context
    const app = createTestApp(undefined);

    const meRes = await supertest(app).get("/api/auth/me");
    expect(meRes.status).toBe(401);

    const leadsRes = await supertest(app).get("/api/leads");
    expect(leadsRes.status).toBe(401);
  });
});
