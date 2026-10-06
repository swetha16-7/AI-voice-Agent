import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import supertest from "supertest";
import { verifyRetellSignature, computeRetellSignature } from "./lib/providers";

// In-memory stores
interface CallRow {
  id: string;
  businessId: string;
  providerCallId: string | null;
  status: string;
  durationSeconds?: number | null;
  summary?: string | null;
  leadId: string;
}

let callsStore: CallRow[] = [];
let providerEventsStore: any[] = [];

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
          if (table === actual.callsTable) {
            result = callsStore.filter((c) => {
              const hasBiz = vals.includes(c.businessId);
              const hasProvId = c.providerCallId && vals.includes(c.providerCallId);
              const hasId = vals.includes(c.id);
              return hasBiz && (hasProvId || hasId);
            });
          } else if (table === actual.providerEventsTable) {
            result = providerEventsStore.filter((e) => vals.includes(e.businessId));
          }
          const p = Promise.resolve(result);
          (p as any).limit = (n: number) => Promise.resolve(result.slice(0, n));
          return p;
        },
      }),
    }),
    insert: (table: any) => ({
      values: (vals: any) => ({
        onConflictDoNothing: () => ({
          returning: () => {
            if (table === actual.providerEventsTable) {
              const exists = providerEventsStore.some(
                (e) => e.provider === vals.provider && e.externalEventId === vals.externalEventId,
              );
              if (exists) return Promise.resolve([]);
              const newRow = { id: `pe_${Date.now()}`, ...vals, processedAt: new Date() };
              providerEventsStore.push(newRow);
              return Promise.resolve([{ id: newRow.id }]);
            }
            return Promise.resolve([{ id: `ins_${Date.now()}` }]);
          },
        }),
        returning: () => Promise.resolve([{ id: `ins_${Date.now()}` }]),
      }),
    }),
    update: (table: any) => ({
      set: (setVals: any) => ({
        where: (condition: any) => {
          const vals = extractValues(condition);
          if (table === actual.callsTable) {
            for (const call of callsStore) {
              if (vals.includes(call.id)) {
                Object.assign(call, setVals);
              }
            }
          }
          return Promise.resolve([{ id: "updated" }]);
        },
      }),
    }),
    transaction: async (cb: (tx: any) => Promise<any>) => cb(mockDb),
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

describe("Retell Webhook Signature & Event Verification", () => {
  const FIXED_NOW = 1726050000000;
  const TEST_API_KEY = "key_retell_test_live_12345";
  const TEST_OVERRIDE_SECRET = "whsec_retell_override_67890";
  const app = createWebhookApp();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_NOW));

    delete process.env.RETELL_WEBHOOK_SECRET;
    process.env.RETELL_API_KEY = TEST_API_KEY;

    callsStore = [
      {
        id: "call_local_1",
        businessId: "biz_retell_1",
        providerCallId: "call_retell_100",
        status: "in_progress",
        leadId: "lead_1",
      },
    ];
    providerEventsStore = [];
  });

  // ---- 1. Unit tests for verifyRetellSignature ----

  describe("Unit: verifyRetellSignature", () => {
    it("accepts a correctly formatted signature matching raw body + timestamp", () => {
      const body = JSON.stringify({ event: "call_ended", call_id: "123" });
      const signature = computeRetellSignature(body, TEST_API_KEY, FIXED_NOW);

      const result = verifyRetellSignature(Buffer.from(body), signature, TEST_API_KEY, { now: FIXED_NOW });
      expect(result.valid).toBe(true);
      expect(result.timestamp).toBe(FIXED_NOW);
    });

    it("accepts a string body (not Buffer) correctly", () => {
      const body = JSON.stringify({ event: "call_started" });
      const signature = computeRetellSignature(body, TEST_API_KEY, FIXED_NOW);

      const result = verifyRetellSignature(body, signature, TEST_API_KEY, { now: FIXED_NOW });
      expect(result.valid).toBe(true);
    });

    it("rejects an invalid signature (wrong key)", () => {
      const body = JSON.stringify({ event: "call_ended" });
      const signature = computeRetellSignature(body, "wrong_key", FIXED_NOW);

      const result = verifyRetellSignature(Buffer.from(body), signature, TEST_API_KEY, { now: FIXED_NOW });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Signature mismatch");
    });

    it("rejects a stale timestamp (> 5 minutes old)", () => {
      const body = JSON.stringify({ event: "call_ended" });
      const staleTime = FIXED_NOW - 6 * 60 * 1000; // 6 minutes ago
      const signature = computeRetellSignature(body, TEST_API_KEY, staleTime);

      const result = verifyRetellSignature(Buffer.from(body), signature, TEST_API_KEY, { now: FIXED_NOW });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Timestamp outside freshness window");
    });

    it("accepts a timestamp exactly at 5-minute boundary", () => {
      const body = JSON.stringify({ event: "call_ended" });
      const borderTime = FIXED_NOW - 5 * 60 * 1000; // exactly 5 minutes
      const signature = computeRetellSignature(body, TEST_API_KEY, borderTime);

      const result = verifyRetellSignature(Buffer.from(body), signature, TEST_API_KEY, {
        now: FIXED_NOW,
        maxAgeMs: 5 * 60 * 1000,
      });
      expect(result.valid).toBe(true);
    });

    it("rejects a tampered body", () => {
      const originalBody = JSON.stringify({ event: "call_ended", call_id: "123" });
      const signature = computeRetellSignature(originalBody, TEST_API_KEY, FIXED_NOW);
      const tamperedBody = JSON.stringify({ event: "call_ended", call_id: "999" });

      const result = verifyRetellSignature(Buffer.from(tamperedBody), signature, TEST_API_KEY, { now: FIXED_NOW });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Signature mismatch");
    });

    it("rejects malformed signature missing v= prefix", () => {
      const result = verifyRetellSignature(Buffer.from("{}"), "random_hex_string", TEST_API_KEY);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Malformed");
    });

    it("rejects malformed signature with v= only and no d=", () => {
      const result = verifyRetellSignature(Buffer.from("{}"), `v=${FIXED_NOW}`, TEST_API_KEY);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Malformed");
    });

    it("rejects when signature is undefined", () => {
      const result = verifyRetellSignature(Buffer.from("{}"), undefined, TEST_API_KEY);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Missing signature or secret");
    });

    it("rejects when secret is undefined", () => {
      const body = "{}";
      const signature = computeRetellSignature(body, TEST_API_KEY, FIXED_NOW);
      const result = verifyRetellSignature(Buffer.from(body), signature, undefined);
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("Missing signature or secret");
    });

    it("rejects old sha256=<hex> format used by other providers", () => {
      const body = JSON.stringify({ event: "call_ended" });
      const oldStyleSig = "sha256=abcdef01234567890123456789012345678901234567890123456789012345";
      const result = verifyRetellSignature(Buffer.from(body), oldStyleSig, TEST_API_KEY, { now: FIXED_NOW });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Malformed");
    });
  });

  // ---- 2. Integration tests for /api/webhooks/retell ----

  describe("Integration: /api/webhooks/retell", () => {
    it("accepts valid flat payload signed with RETELL_API_KEY", async () => {
      const payload = {
        event: "call_ended",
        call_id: "call_retell_100",
        call_status: "completed",
        duration_ms: 60000,
        metadata: { business_id: "biz_retell_1" },
      };
      const bodyStr = JSON.stringify(payload);
      const signature = computeRetellSignature(bodyStr, TEST_API_KEY, FIXED_NOW);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body.accepted).toBe(true);
    });

    it("accepts valid nested call payload structure", async () => {
      const payload = {
        event: "call_analyzed",
        call: {
          call_id: "call_retell_100",
          call_status: "call_analyzed",
          duration_ms: 120000,
          call_analysis: {
            call_summary: "Customer requested a quote for kitchen remodeling.",
          },
          metadata: { business_id: "biz_retell_1" },
        },
      };
      const bodyStr = JSON.stringify(payload);
      const signature = computeRetellSignature(bodyStr, TEST_API_KEY, FIXED_NOW);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body.accepted).toBe(true);
    });

    it("returns 401 for invalid signature", async () => {
      const payload = {
        event: "call_ended",
        call_id: "call_retell_100",
        metadata: { business_id: "biz_retell_1" },
      };
      const badSig = `v=${FIXED_NOW},d=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`;

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", badSig)
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid Retell signature");
    });

    it("returns 401 for tampered body", async () => {
      const originalPayload = {
        event: "call_ended",
        call_id: "call_retell_100",
        metadata: { business_id: "biz_retell_1" },
      };
      const signature = computeRetellSignature(JSON.stringify(originalPayload), TEST_API_KEY, FIXED_NOW);

      // Send a different body but same signature
      const tamperedPayload = { ...originalPayload, call_id: "call_tampered_999" };

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(tamperedPayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid Retell signature");
    });

    it("returns 401 for stale signature timestamp", async () => {
      const payload = {
        event: "call_ended",
        call_id: "call_retell_100",
        metadata: { business_id: "biz_retell_1" },
      };
      const staleSignature = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, FIXED_NOW - 10 * 60 * 1000);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", staleSignature)
        .send(payload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid Retell signature");
    });

    it("returns 200 { accepted:true, test:true } for signed dashboard test ping (no business_id)", async () => {
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
      const signature = computeRetellSignature(bodyStr, TEST_API_KEY, FIXED_NOW);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(testPayload);

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
      expect(res.body.test).toBe(true);
    });

    it("returns 200 { accepted:true, test:true } for dashboard test ping with no call or metadata", async () => {
      const minimalPayload = { event: "call_started" };
      const bodyStr = JSON.stringify(minimalPayload);
      const signature = computeRetellSignature(bodyStr, TEST_API_KEY, FIXED_NOW);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(minimalPayload);

      expect(res.status).toBe(200);
      expect(res.body.accepted).toBe(true);
      expect(res.body.test).toBe(true);
    });

    it("uses RETELL_WEBHOOK_SECRET as fallback when it differs from RETELL_API_KEY", async () => {
      process.env.RETELL_WEBHOOK_SECRET = TEST_OVERRIDE_SECRET;

      const payload = {
        event: "call_ended",
        call_id: "call_retell_100",
        call_status: "completed",
        metadata: { business_id: "biz_retell_1" },
      };
      const bodyStr = JSON.stringify(payload);
      // Sign with override secret (different from the API key)
      const signature = computeRetellSignature(bodyStr, TEST_OVERRIDE_SECRET, FIXED_NOW);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res.status).toBe(202);
      expect(res.body.accepted).toBe(true);
    });

    it("returns 401 if no RETELL_API_KEY or RETELL_WEBHOOK_SECRET is set", async () => {
      delete process.env.RETELL_API_KEY;
      delete process.env.RETELL_WEBHOOK_SECRET;

      const payload = {
        event: "call_ended",
        call_id: "call_retell_100",
        metadata: { business_id: "biz_retell_1" },
      };
      const signature = computeRetellSignature(JSON.stringify(payload), TEST_API_KEY, FIXED_NOW);

      const res = await supertest(app)
        .post("/api/webhooks/retell")
        .set("Content-Type", "application/json")
        .set("x-retell-signature", signature)
        .send(payload);

      expect(res.status).toBe(401);
    });
  });
});
