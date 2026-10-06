import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import supertest from "supertest";
import { verifyRetellSignature, computeRetellSignature } from "./lib/providers";

// In-memory stores
interface CallRow {
  id: string;
  businessId: string;
  provider: string;
  providerCallId: string | null;
  idempotencyKey?: string;
  contactId: string;
  leadId: string;
  status: string;
  startedAt?: Date | null;
  endedAt?: Date | null;
  durationSeconds?: number | null;
  summary?: string | null;
  outcome?: string | null;
  transferred?: boolean;
  booked?: boolean;
  errorState?: string | null;
  createdAt?: Date;
}

interface LeadRow {
  id: string;
  businessId: string;
  contactId: string;
  status: string;
  nextAction?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ContactRow {
  id: string;
  businessId: string;
  name: string;
  phone: string;
}

interface WorkflowJobRow {
  id: string;
  businessId: string;
  idempotencyKey: string;
  status: string;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  leaseExpiresAt?: Date | null;
  lastError?: string | null;
}

interface BusinessRow {
  id: string;
  name: string;
}

let businessesStore: BusinessRow[] = [];
let callsStore: CallRow[] = [];
let leadsStore: LeadRow[] = [];
let contactsStore: ContactRow[] = [];
let workflowJobsStore: WorkflowJobRow[] = [];
let providerEventsStore: any[] = [];
let activitiesStore: any[] = [];
let simulateTxFailure = false;

function extractValues(obj: any): any[] {
  const values: any[] = [];
  if (!obj) return values;
  if ("value" in obj && obj.value !== undefined) values.push(obj.value);
  if (Array.isArray(obj.queryChunks)) {
    for (const chunk of obj.queryChunks) {
      values.push(...extractValues(chunk));
    }
  }
  return values;
}

vi.mock("@workspace/db", async () => {
  const actual = await vi.importActual<any>("@workspace/db");

  const mockDb = {
    select: (_fields?: any) => ({
      from: (table: any) => ({
        where: (condition: any) => {
          const vals = extractValues(condition);
          let result: any[] = [];
          if (table === actual.businessesTable) {
            result = businessesStore.filter((b) => vals.includes(b.id));
          } else if (table === actual.callsTable) {
            result = callsStore.filter((c) => {
              const hasBiz = vals.includes(c.businessId);
              const hasProvId = c.providerCallId && vals.includes(c.providerCallId);
              const hasId = vals.includes(c.id);
              return hasBiz && (hasProvId || hasId);
            });
          } else if (table === actual.leadsTable) {
            result = leadsStore.filter((l) => {
              const hasBiz = vals.includes(l.businessId);
              const hasId = vals.includes(l.id);
              const hasContact = vals.includes(l.contactId);
              return hasBiz && (hasId || hasContact);
            });
          } else if (table === actual.contactsTable) {
            result = contactsStore.filter((ct) => {
              const hasBiz = vals.includes(ct.businessId);
              const hasPhone = vals.includes(ct.phone);
              const hasId = vals.includes(ct.id);
              return hasBiz && (hasPhone || hasId);
            });
          } else if (table === actual.providerEventsTable) {
            result = providerEventsStore.filter((e) => vals.includes(e.businessId));
          } else if (table === actual.workflowJobsTable) {
            result = workflowJobsStore.filter((j) => vals.includes(j.businessId));
          }
          const p = Promise.resolve(result);
          (p as any).limit = (n: number) => Promise.resolve(result.slice(0, n));
          (p as any).orderBy = () => {
            const op = Promise.resolve(result);
            (op as any).limit = (n: number) => Promise.resolve(result.slice(0, n));
            return op;
          };
          return p;
        },
      }),
    }),
    insert: (table: any) => ({
      values: (vals: any) => ({
        onConflictDoNothing: () => ({
          returning: () => {
            if (simulateTxFailure && table === actual.callsTable) {
              throw new Error("Simulated database failure during call insert");
            }
            if (table === actual.providerEventsTable) {
              const exists = providerEventsStore.some(
                (e) => e.provider === vals.provider && e.externalEventId === vals.externalEventId,
              );
              if (exists) return Promise.resolve([]);
              const newRow = { id: `pe_${Date.now()}_${Math.random()}`, ...vals, processedAt: new Date() };
              providerEventsStore.push(newRow);
              return Promise.resolve([{ id: newRow.id }]);
            }
            if (table === actual.callsTable) {
              const exists = callsStore.some(
                (c) =>
                  c.businessId === vals.businessId &&
                  (c.id === vals.id || (c.providerCallId && c.providerCallId === vals.providerCallId)),
              );
              if (exists) return Promise.resolve([]);
              const newCall: CallRow = {
                id: vals.id ?? `call_${Date.now()}`,
                businessId: vals.businessId,
                provider: vals.provider ?? "Retell",
                providerCallId: vals.providerCallId ?? null,
                contactId: vals.contactId,
                leadId: vals.leadId,
                status: vals.status ?? "in_progress",
                startedAt: vals.startedAt ?? new Date(),
                endedAt: vals.endedAt ?? null,
                durationSeconds: vals.durationSeconds ?? null,
                summary: vals.summary ?? null,
                outcome: vals.outcome ?? null,
                transferred: vals.transferred ?? false,
                booked: vals.booked ?? false,
                errorState: vals.errorState ?? null,
                createdAt: new Date(),
              };
              callsStore.push(newCall);
              return Promise.resolve([newCall]);
            }
            return Promise.resolve([{ id: `ins_${Date.now()}` }]);
          },
        }),
        returning: () => {
          if (simulateTxFailure && table === actual.callsTable) {
            throw new Error("Simulated database failure during call insert");
          }
          if (table === actual.callsTable) {
            const newCall: CallRow = {
              id: vals.id ?? `call_${Date.now()}`,
              businessId: vals.businessId,
              provider: vals.provider ?? "Retell",
              providerCallId: vals.providerCallId ?? null,
              contactId: vals.contactId,
              leadId: vals.leadId,
              status: vals.status ?? "in_progress",
              startedAt: vals.startedAt ?? new Date(),
              endedAt: vals.endedAt ?? null,
              durationSeconds: vals.durationSeconds ?? null,
              summary: vals.summary ?? null,
              outcome: vals.outcome ?? null,
              transferred: vals.transferred ?? false,
              booked: vals.booked ?? false,
              errorState: vals.errorState ?? null,
              createdAt: new Date(),
            };
            callsStore.push(newCall);
            return Promise.resolve([newCall]);
          }
          if (table === actual.contactsTable) {
            contactsStore.push(vals);
            return Promise.resolve([vals]);
          }
          if (table === actual.leadsTable) {
            leadsStore.push(vals);
            return Promise.resolve([vals]);
          }
          if (table === actual.activitiesTable) {
            activitiesStore.push(vals);
            return Promise.resolve([vals]);
          }
          return Promise.resolve([{ id: `ins_${Date.now()}` }]);
        },
      }),
    }),
    update: (table: any) => ({
      set: (setVals: any) => ({
        where: (condition: any) => {
          if (simulateTxFailure && table === actual.callsTable) {
            throw new Error("Simulated database failure during call update");
          }
          const vals = extractValues(condition);
          if (table === actual.callsTable) {
            for (const call of callsStore) {
              if (vals.includes(call.id)) {
                Object.assign(call, setVals);
              }
            }
          } else if (table === actual.workflowJobsTable) {
            for (const job of workflowJobsStore) {
              if (vals.includes(job.idempotencyKey) || vals.includes(job.id)) {
                Object.assign(job, setVals);
              }
            }
          } else if (table === actual.leadsTable) {
            for (const lead of leadsStore) {
              if (vals.includes(lead.id)) {
                Object.assign(lead, setVals);
              }
            }
          }
          return Promise.resolve([{ id: "updated" }]);
        },
      }),
    }),
    transaction: async (cb: (tx: any) => Promise<any>) => {
      const callsSnapshot = callsStore.map((c) => ({ ...c }));
      const leadsSnapshot = leadsStore.map((l) => ({ ...l }));
      const contactsSnapshot = contactsStore.map((ct) => ({ ...ct }));
      const eventsSnapshot = providerEventsStore.map((e) => ({ ...e }));
      const actSnapshot = activitiesStore.map((ac) => ({ ...ac }));

      try {
        return await cb(mockDb);
      } catch (err) {
        callsStore = callsSnapshot;
        leadsStore = leadsSnapshot;
        contactsStore = contactsSnapshot;
        providerEventsStore = eventsSnapshot;
        activitiesStore = actSnapshot;
        throw err;
      }
    },
  };

  return { ...actual, db: mockDb };
});

vi.mock("./lib/usage", async () => {
  const actual = await vi.importActual<any>("./lib/usage");
  return {
    ...actual,
    getActiveUsageRow: vi.fn().mockResolvedValue({
      id: "usage_retell_1",
      businessId: "biz_retell_1",
      voiceMinutes: 0,
      estimatedCost: 0,
    }),
  };
});

// Import after mocks are registered
import webhooksRouter from "./routes/webhooks";

function createWebhookApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buffer) => {
        (req as any).rawBody = Buffer.from(buffer);
      },
    }),
  );
  app.use("/api", webhooksRouter);
  return app;
}

describe("Retell Webhook Signature & Call Lifecycle", () => {
  const TEST_API_KEY = "key_retell_test_live_12345";
  const TEST_OVERRIDE_SECRET = "whsec_retell_override_67890";
  const app = createWebhookApp();

  beforeEach(() => {
    delete process.env.RETELL_WEBHOOK_SECRET;
    process.env.RETELL_API_KEY = TEST_API_KEY;
    simulateTxFailure = false;

    businessesStore = [
      { id: "biz_retell_1", name: "Northstar Realty" },
      { id: "biz_retell_2", name: "Other Tenant Realty" },
    ];

    contactsStore = [
      {
        id: "contact_1",
        businessId: "biz_retell_1",
        name: "Maya Patel",
        phone: "+14155552671",
      },
      {
        id: "contact_2",
        businessId: "biz_retell_2",
        name: "Other Tenant Contact",
        phone: "+14155559999",
      },
    ];

    leadsStore = [
      {
        id: "lead_1",
        businessId: "biz_retell_1",
        contactId: "contact_1",
        status: "new",
        createdAt: new Date(Date.now() - 100000),
      },
      {
        id: "lead_2",
        businessId: "biz_retell_2",
        contactId: "contact_2",
        status: "new",
        createdAt: new Date(Date.now() - 100000),
      },
    ];

    callsStore = [
      {
        id: "call_local_1",
        businessId: "biz_retell_1",
        provider: "Retell",
        providerCallId: "call_retell_100",
        contactId: "contact_1",
        leadId: "lead_1",
        status: "queued",
        summary: "Call queued.",
        outcome: "Queued",
      },
    ];

    workflowJobsStore = [
      {
        id: "job_1",
        businessId: "biz_retell_1",
        idempotencyKey: "call_local_1",
        status: "queued",
      },
    ];

    providerEventsStore = [];
    activitiesStore = [];
  });

  // ---- 1. Unit tests for verifyRetellSignature ----

  describe("Unit: verifyRetellSignature", () => {
    it("accepts a correctly formatted signature matching raw body + timestamp", () => {
      const now = Date.now();
      const body = JSON.stringify({ event: "call_ended", call_id: "123" });
      const signature = computeRetellSignature(body, TEST_API_KEY, now);

      const result = verifyRetellSignature(Buffer.from(body), signature, TEST_API_KEY, { now });
      expect(result.valid).toBe(true);
      expect(result.timestamp).toBe(now);
    });

    it("accepts a string body (not Buffer) correctly", () => {
      const now = Date.now();
      const body = JSON.stringify({ event: "call_started" });
      const signature = computeRetellSignature(body, TEST_API_KEY, now);

      const result = verifyRetellSignature(body, signature, TEST_API_KEY, { now });
      expect(result.valid).toBe(true);
    });

    it("rejects an invalid signature (wrong key)", () => {
      const now = Date.now();
      const body = JSON.stringify({ event: "call_ended" });
      const signature = computeRetellSignature(body, "wrong_key", now);

      const result = verifyRetellSignature(Buffer.from(body), signature, TEST_API_KEY, { now });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Signature mismatch");
    });

    it("rejects a stale timestamp (> 5 minutes old)", () => {
      const now = Date.now();
      const body = JSON.stringify({ event: "call_ended" });
      const staleTime = now - 6 * 60 * 1000;
      const signature = computeRetellSignature(body, TEST_API_KEY, staleTime);

      const result = verifyRetellSignature(Buffer.from(body), signature, TEST_API_KEY, { now });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Timestamp outside freshness window");
    });

    it("accepts a timestamp exactly at 5-minute boundary", () => {
      const now = Date.now();
      const body = JSON.stringify({ event: "call_ended" });
      const borderTime = now - 5 * 60 * 1000;
      const signature = computeRetellSignature(body, TEST_API_KEY, borderTime);

      const result = verifyRetellSignature(Buffer.from(body), signature, TEST_API_KEY, {
        now,
        maxAgeMs: 5 * 60 * 1000,
      });
      expect(result.valid).toBe(true);
    });

    it("rejects a tampered body", () => {
      const now = Date.now();
      const originalBody = JSON.stringify({ event: "call_ended", call_id: "123" });
      const signature = computeRetellSignature(originalBody, TEST_API_KEY, now);
      const tamperedBody = JSON.stringify({ event: "call_ended", call_id: "999" });

      const result = verifyRetellSignature(Buffer.from(tamperedBody), signature, TEST_API_KEY, { now });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Signature mismatch");
    });

    it("rejects malformed signature missing v= prefix", () => {
      const result = verifyRetellSignature(Buffer.from("{}"), "random_hex_string", TEST_API_KEY);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Malformed");
    });

    it("rejects malformed signature with v= only and no d=", () => {
      const result = verifyRetellSignature(Buffer.from("{}"), `v=${Date.now()}`, TEST_API_KEY);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Malformed");
    });

    it("rejects when signature is undefined", () => {
      const result = verifyRetellSignature(Buffer.from("{}"), undefined, TEST_API_KEY);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Missing signature or secret");
    });

    it("rejects when secret is undefined", () => {
      const now = Date.now();
      const body = "{}";
      const signature = computeRetellSignature(body, TEST_API_KEY, now);
      const result = verifyRetellSignature(Buffer.from(body), signature, undefined);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Missing signature or secret");
    });

    it("rejects old sha256=<hex> format used by other providers", () => {
      const now = Date.now();
      const body = JSON.stringify({ event: "call_ended" });
      const oldStyleSig = "sha256=abcdef01234567890123456789012345678901234567890123456789012345";
      const result = verifyRetellSignature(Buffer.from(body), oldStyleSig, TEST_API_KEY, { now });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Malformed");
    });
  });

  // ---- 2. Integration & Lifecycle Tests ----

  describe("Integration & Lifecycle: /api/webhooks/retell", () => {
    it("A. call_started updates existing call to in_progress", async () => {
      const now = Date.now();
      const payload = {
        event: "call_started",
        call: {
          call_id: "call_retell_100",
          call_status: "in_progress",
          start_timestamp: now,
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const signature = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, now);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body.accepted).toBe(true);

      const call = callsStore.find((c) => c.providerCallId === "call_retell_100");
      expect(call).toBeDefined();
      expect(call?.status).toBe("in_progress");
      expect(call?.startedAt).toBeDefined();
      expect(callsStore.length).toBe(1);
    });

    it("A2. call_started provisions a new call when not pre-seeded", async () => {
      const now = Date.now();
      const payload = {
        event: "call_started",
        call: {
          call_id: "call_retell_new_999",
          customer_number: "+14155552671",
          start_timestamp: now,
          metadata: { business_id: "biz_retell_1", lead_id: "lead_1" },
        },
      };
      const signature = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, now);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body.accepted).toBe(true);

      const newCall = callsStore.find((c) => c.providerCallId === "call_retell_new_999");
      expect(newCall).toBeDefined();
      expect(newCall?.businessId).toBe("biz_retell_1");
      expect(newCall?.status).toBe("in_progress");
      expect(newCall?.leadId).toBe("lead_1");
    });

    it("ISSUE 1 TEST: call_ended before call_started with no pre-existing calls row maintains exactly ONE call row", async () => {
      const now = Date.now();
      const unseededCallId = "call_retell_out_of_order_123";

      // 1. call_ended arrives FIRST (no call row exists in DB)
      const endPayload = {
        event: "call_ended",
        call: {
          call_id: unseededCallId,
          call_status: "ended",
          duration_ms: 75000,
          end_timestamp: now + 75000,
          disconnection_reason: "user_hangup",
          customer_number: "+14155552671",
          metadata: { business_id: "biz_retell_1", lead_id: "lead_1" },
        },
      };
      const endSig = computeRetellSignature(JSON.stringify(endPayload), TEST_API_KEY, now);
      const res1 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", endSig)
        .send(endPayload);

      expect(res1.status).toBe(202);
      expect(res1.body.accepted).toBe(true);

      // Verify provisioned call is completed
      const createdCalls = callsStore.filter((c) => c.providerCallId === unseededCallId);
      expect(createdCalls.length).toBe(1);
      expect(createdCalls[0].status).toBe("completed");
      expect(createdCalls[0].durationSeconds).toBe(75);
      expect(createdCalls[0].outcome).toBe("user_hangup");

      // 2. Delayed call_started arrives LATER
      const startPayload = {
        event: "call_started",
        call: {
          call_id: unseededCallId,
          start_timestamp: now,
          customer_number: "+14155552671",
          metadata: { business_id: "biz_retell_1", lead_id: "lead_1" },
        },
      };
      const startSig = computeRetellSignature(JSON.stringify(startPayload), TEST_API_KEY, now);
      const res2 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", startSig)
        .send(startPayload);

      expect(res2.status).toBe(202);
      expect(res2.body.accepted).toBe(true);

      // Verify STILL exactly ONE call row in DB and status did NOT regress
      const finalCalls = callsStore.filter((c) => c.providerCallId === unseededCallId);
      expect(finalCalls.length).toBe(1);
      expect(finalCalls[0].status).toBe("completed");
      expect(finalCalls[0].durationSeconds).toBe(75);
      expect(finalCalls[0].startedAt).toBeDefined();
    });

    it("ISSUE 2 TEST: lifecycle transaction failure rolls back event deduplication and permits retry", async () => {
      const now = Date.now();
      simulateTxFailure = true;

      const payload = {
        event: "call_ended",
        call: {
          call_id: "call_retell_100",
          call_status: "ended",
          duration_ms: 30000,
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const signature = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, now);

      // 1. First attempt fails due to simulated DB failure
      const res1 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res1.status).toBe(500);
      expect(res1.body.error).toBe("Failed to process Retell event");

      // Verify event was NOT permanently marked as processed in provider_events
      expect(providerEventsStore.some((e) => e.externalEventId === "call_ended:call_retell_100")).toBe(false);

      // 2. Provider retries the event after DB recovers
      simulateTxFailure = false;

      const res2 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res2.status).toBe(202);
      expect(res2.body.accepted).toBe(true);
      expect(res2.body.duplicate).toBe(false);

      // Call is now completed
      const call = callsStore.find((c) => c.providerCallId === "call_retell_100");
      expect(call?.status).toBe("completed");
      expect(call?.durationSeconds).toBe(30);
    });

    it("B & L. duplicate call_started does not create duplicate call and returns duplicate: true", async () => {
      const now = Date.now();
      const payload = {
        event: "call_started",
        call: {
          call_id: "call_retell_100",
          call_status: "in_progress",
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const signature = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, now);

      // 1st delivery
      const res1 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);
      expect(res1.status).toBe(202);
      expect(res1.body.duplicate).toBe(false);

      // 2nd delivery (exact same event)
      const res2 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);
      expect(res2.status).toBe(202);
      expect(res2.body.duplicate).toBe(true);

      expect(callsStore.filter((c) => c.providerCallId === "call_retell_100").length).toBe(1);
    });

    it("C & D. call_ended updates the SAME call without creating a second call", async () => {
      const now = Date.now();
      callsStore[0].status = "in_progress";
      callsStore[0].startedAt = new Date(now - 60000);

      const payload = {
        event: "call_ended",
        call: {
          call_id: "call_retell_100",
          call_status: "ended",
          duration_ms: 60000,
          end_timestamp: now,
          disconnection_reason: "user_hangup",
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const signature = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, now);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body.accepted).toBe(true);

      expect(callsStore.length).toBe(1);
      const call = callsStore[0];
      expect(call.status).toBe("completed");
      expect(call.durationSeconds).toBe(60);
      expect(call.outcome).toBe("user_hangup");
      expect(call.endedAt).toBeDefined();
    });

    it("E. call_analyzed updates the SAME call preserving status and duration while adding summary", async () => {
      const now = Date.now();
      callsStore[0].status = "completed";
      callsStore[0].startedAt = new Date(now - 120000);
      callsStore[0].endedAt = new Date(now);
      callsStore[0].durationSeconds = 120;

      const payload = {
        event: "call_analyzed",
        call: {
          call_id: "call_retell_100",
          call_status: "call_analyzed",
          duration_ms: 120000,
          call_analysis: {
            call_summary: "Buyer is interested in 3-bedroom villa and budget is $500k.",
            user_sentiment: "positive",
          },
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const signature = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, now);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body.accepted).toBe(true);

      expect(callsStore.length).toBe(1);
      const call = callsStore[0];
      expect(call.status).toBe("completed");
      expect(call.durationSeconds).toBe(120);
      expect(call.summary).toBe("Buyer is interested in 3-bedroom villa and budget is $500k.");
    });

    it("F & K. call_started + call_ended + call_analyzed progresses smoothly and deduplication distinguishes events", async () => {
      const now = Date.now();
      // 1. call_started
      const startPayload = {
        event: "call_started",
        call: {
          call_id: "call_retell_100",
          start_timestamp: now,
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const sig1 = computeRetellSignature(JSON.stringify(startPayload), TEST_API_KEY, now);
      const res1 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", sig1)
        .send(startPayload);
      expect(res1.status).toBe(202);
      expect(res1.body.duplicate).toBe(false);
      expect(callsStore[0].status).toBe("in_progress");

      // 2. call_ended (distinct event identity call_ended:call_retell_100)
      const endPayload = {
        event: "call_ended",
        call: {
          call_id: "call_retell_100",
          duration_ms: 45000,
          end_timestamp: now + 45000,
          disconnection_reason: "agent_hangup",
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const sig2 = computeRetellSignature(JSON.stringify(endPayload), TEST_API_KEY, now);
      const res2 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", sig2)
        .send(endPayload);
      expect(res2.status).toBe(202);
      expect(res2.body.duplicate).toBe(false);
      expect(callsStore[0].status).toBe("completed");
      expect(callsStore[0].durationSeconds).toBe(45);

      // 3. call_analyzed (distinct event identity call_analyzed:call_retell_100)
      const analyzedPayload = {
        event: "call_analyzed",
        call: {
          call_id: "call_retell_100",
          call_analysis: {
            call_summary: "Lead requested follow-up tomorrow at 2 PM.",
          },
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const sig3 = computeRetellSignature(JSON.stringify(analyzedPayload), TEST_API_KEY, now);
      const res3 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", sig3)
        .send(analyzedPayload);
      expect(res3.status).toBe(202);
      expect(res3.body.duplicate).toBe(false);

      // Exactly ONE call row maintained
      expect(callsStore.length).toBe(1);
      const call = callsStore[0];
      expect(call.status).toBe("completed");
      expect(call.durationSeconds).toBe(45);
      expect(call.summary).toBe("Lead requested follow-up tomorrow at 2 PM.");
    });

    it("G. duplicate call_ended is idempotent", async () => {
      const now = Date.now();
      const endPayload = {
        event: "call_ended",
        call: {
          call_id: "call_retell_100",
          duration_ms: 50000,
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const sig = computeRetellSignature(JSON.stringify(endPayload), TEST_API_KEY, now);

      const res1 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", sig)
        .send(endPayload);
      expect(res1.body.duplicate).toBe(false);

      const res2 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", sig)
        .send(endPayload);
      expect(res2.body.duplicate).toBe(true);

      expect(callsStore[0].status).toBe("completed");
    });

    it("H. duplicate call_analyzed is idempotent", async () => {
      const now = Date.now();
      const analyzedPayload = {
        event: "call_analyzed",
        call: {
          call_id: "call_retell_100",
          call_analysis: { call_summary: "Summary test" },
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const sig = computeRetellSignature(JSON.stringify(analyzedPayload), TEST_API_KEY, now);

      const res1 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", sig)
        .send(analyzedPayload);
      expect(res1.body.duplicate).toBe(false);

      const res2 = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", sig)
        .send(analyzedPayload);
      expect(res2.body.duplicate).toBe(true);

      expect(callsStore[0].summary).toBe("Summary test");
    });

    it("I. delayed call_started does not regress a completed call to in_progress", async () => {
      const now = Date.now();
      // 1. Call completes first
      const endPayload = {
        event: "call_ended",
        call: {
          call_id: "call_retell_100",
          duration_ms: 30000,
          end_timestamp: now,
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const sigEnd = computeRetellSignature(JSON.stringify(endPayload), TEST_API_KEY, now);
      await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", sigEnd)
        .send(endPayload);
      expect(callsStore[0].status).toBe("completed");

      // 2. Delayed call_started arrives later
      const startPayload = {
        event: "call_started",
        call: {
          call_id: "call_retell_100",
          start_timestamp: now - 30000,
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const sigStart = computeRetellSignature(JSON.stringify(startPayload), TEST_API_KEY, now);
      await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", sigStart)
        .send(startPayload);

      // Must STAY completed, NOT regressed to in_progress!
      expect(callsStore[0].status).toBe("completed");
    });

    it("J. tenant isolation prevents Business B webhook from mutating Business A call", async () => {
      const now = Date.now();
      const payload = {
        event: "call_ended",
        call: {
          call_id: "call_retell_100", // Belongs to biz_retell_1
          metadata: { business_id: "biz_retell_2" }, // Targeted to biz_retell_2
        },
      };
      const sig = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, now);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", sig)
        .send(payload);

      expect(res.status).toBe(202);

      // Business 1's call remains unmodified (queued)
      const callA = callsStore.find((c) => c.businessId === "biz_retell_1");
      expect(callA?.status).toBe("queued");
    });

    it("returns 200 { accepted:true, test:true } for signed dashboard test ping (no business_id)", async () => {
      const now = Date.now();
      const testPayload = {
        event: "call_ended",
        call: {
          call_id: "test_call_sample_abc123",
          agent_id: "agent_test_xyz",
          call_status: "ended",
          metadata: {},
        },
      };
      const bodyStr = JSON.stringify(testPayload);
      const signature = computeRetellSignature(bodyStr, TEST_API_KEY, now);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(testPayload);

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
      expect(res.body.test).toBe(true);
    });

    it("uses RETELL_WEBHOOK_SECRET as fallback when it differs from RETELL_API_KEY", async () => {
      const now = Date.now();
      process.env.RETELL_WEBHOOK_SECRET = TEST_OVERRIDE_SECRET;

      const payload = {
        event: "call_ended",
        call: {
          call_id: "call_retell_100",
          call_status: "completed",
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const bodyStr = JSON.stringify(payload);
      const signature = computeRetellSignature(bodyStr, TEST_OVERRIDE_SECRET, now);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body.accepted).toBe(true);
    });

    it("returns 401 if no RETELL_API_KEY or RETELL_WEBHOOK_SECRET is set", async () => {
      const now = Date.now();
      delete process.env.RETELL_API_KEY;
      delete process.env.RETELL_WEBHOOK_SECRET;

      const payload = {
        event: "call_ended",
        call: {
          call_id: "call_retell_100",
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const signature = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, now);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res.status).toBe(401);
    });

    describe("Focused Retell Signature 401 Verification Tests (A - G)", () => {
      it("A. Valid Retell signature with exact raw body -> 202 accepted", async () => {
        const now = Date.now();
        const payload = {
          event: "call_ended",
          call: {
            call_id: "call_retell_valid_raw",
            call_status: "ended",
            metadata: { business_id: "biz_retell_1" },
          },
        };
        const rawBodyStr = JSON.stringify(payload);
        const signature = computeRetellSignature(rawBodyStr, TEST_API_KEY, now);

        const res = await supertest(app)
          .post("/api/webhooks/retell")
          .set("Content-Type", "application/json")
          .set("x-retell-signature", signature)
          .send(payload);

        expect(res.status).toBe(202);
        expect(res.body.accepted).toBe(true);
      });

      it("B. Invalid signature -> 401", async () => {
        const now = Date.now();
        const payload = {
          event: "call_ended",
          call: {
            call_id: "call_retell_invalid_sig",
            metadata: { business_id: "biz_retell_1" },
          },
        };
        const invalidSig = computeRetellSignature(JSON.stringify(payload), "wrong_secret_key", now);

        const res = await supertest(app)
          .post("/api/webhooks/retell")
          .set("Content-Type", "application/json")
          .set("x-retell-signature", invalidSig)
          .send(payload);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Invalid Retell signature");
      });

      it("C. Modified body after signing -> 401", async () => {
        const now = Date.now();
        const originalPayload = {
          event: "call_ended",
          call: {
            call_id: "call_retell_orig",
            metadata: { business_id: "biz_retell_1" },
          },
        };
        const signature = computeRetellSignature(JSON.stringify(originalPayload), TEST_API_KEY, now);

        const tamperedPayload = {
          event: "call_ended",
          call: {
            call_id: "call_retell_tampered",
            metadata: { business_id: "biz_retell_1" },
          },
        };

        const res = await supertest(app)
          .post("/api/webhooks/retell")
          .set("Content-Type", "application/json")
          .set("x-retell-signature", signature)
          .send(tamperedPayload);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Invalid Retell signature");
      });

      it("D. Old timestamp -> 401", async () => {
        const oldTime = Date.now() - 6 * 60 * 1000;
        const payload = {
          event: "call_ended",
          call: {
            call_id: "call_retell_stale",
            metadata: { business_id: "biz_retell_1" },
          },
        };
        const staleSig = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, oldTime);

        const res = await supertest(app)
          .post("/api/webhooks/retell")
          .set("Content-Type", "application/json")
          .set("x-retell-signature", staleSig)
          .send(payload);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Invalid Retell signature");
      });

      it("E. Missing signature -> 401", async () => {
        const payload = {
          event: "call_ended",
          call: {
            call_id: "call_retell_no_sig",
            metadata: { business_id: "biz_retell_1" },
          },
        };

        const res = await supertest(app)
          .post("/api/webhooks/retell")
          .set("Content-Type", "application/json")
          .send(payload);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Invalid Retell signature");
      });

      it("F. Raw body is preserved exactly and is NOT regenerated using JSON.stringify(req.body)", async () => {
        const now = Date.now();
        const formattedPrettyJson = '{\n  "event": "call_ended",\n  "call": {\n    "call_id": "call_pretty_123",\n    "metadata": {\n      "business_id": "biz_retell_1"\n    }\n  }\n}';
        const signature = computeRetellSignature(formattedPrettyJson, TEST_API_KEY, now);

        const res = await supertest(app)
          .post("/api/webhooks/retell")
          .set("Content-Type", "application/json")
          .set("x-retell-signature", signature)
          .send(formattedPrettyJson);

        expect(res.status).toBe(202);
        expect(res.body.accepted).toBe(true);
      });

      it("G. Retell dashboard test webhook request is accepted successfully (200) if valid Retell signature present without business_id", async () => {
        const now = Date.now();
        const dashboardTestPing = {
          event: "call_ended",
          call: {
            call_id: "retell_dashboard_test_ping_xyz",
            agent_id: "agent_dashboard_1",
            call_status: "ended",
          },
        };
        const signature = computeRetellSignature(JSON.stringify(dashboardTestPing), TEST_API_KEY, now);

        const res = await supertest(app)
          .post("/api/webhooks/retell")
          .set("Content-Type", "application/json")
          .set("x-retell-signature", signature)
          .send(dashboardTestPing);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ accepted: true, test: true });
      });
    });
  });
});
