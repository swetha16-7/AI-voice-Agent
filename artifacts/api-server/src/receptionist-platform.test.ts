import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import supertest from "supertest";
import {
  createRetellAgent,
  updateRetellAgent,
  getRetellAgent,
  listRetellAgents,
  providerConfig,
} from "./lib/providers";

// In-memory mock database store for Receptionist Platform testing
let agentsStore: any[] = [];
let messagesStore: any[] = [];
let callsStore: any[] = [];
let businessesStore: any[] = [];
let contactsStore: any[] = [];
let leadsStore: any[] = [];
let appointmentsStore: any[] = [];
let usageStore: any[] = [];

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
              let rows: any[] = [];
              if (table === actual.leadsTable && joinTable === actual.contactsTable) {
                rows = leadsStore
                  .filter((l) => !bizId || l.businessId === bizId)
                  .map((lead) => {
                    const contact = contactsStore.find((c) => c.id === lead.contactId);
                    return { lead, contact };
                  });
              }
              const promise = Promise.resolve(rows);
              (promise as any).orderBy = () => promise;
              (promise as any).limit = (n: number) => {
                const lim = Promise.resolve(rows.slice(0, n));
                (lim as any).offset = (o: number) => Promise.resolve(rows.slice(o, o + n));
                return lim;
              };
              return promise;
            },
          }),
          where: (condition: any) => {
            const vals = extractVals(condition);
            let result: any[] = [];
            if (table === actual.agentsTable) {
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              const specificId = vals.find((v) => typeof v === "string" && v.startsWith("agent_"));
              result = agentsStore.filter(
                (a) => (!bizId || a.businessId === bizId) && (!specificId || a.id === specificId),
              );
            } else if (table === actual.messagesTable) {
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              const specificId = vals.find((v) => typeof v === "string" && v.startsWith("msg_"));
              result = messagesStore.filter(
                (m) => (!bizId || m.businessId === bizId) && (!specificId || m.id === specificId),
              );
            } else if (table === actual.callsTable) {
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              const specificId = vals.find((v) => typeof v === "string" && (v.startsWith("call_") || v.startsWith("lead_")));
              result = callsStore.filter(
                (c) => (!bizId || c.businessId === bizId) && (!specificId || c.id === specificId || c.leadId === specificId),
              );
            } else if (table === actual.businessesTable) {
              result = businessesStore.filter((b) => vals.includes(b.id));
            } else if (table === actual.appointmentsTable) {
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              result = appointmentsStore.filter((a) => !bizId || a.businessId === bizId);
            } else if (table === actual.contactsTable) {
              result = contactsStore.filter((c) => vals.includes(c.id));
            } else if (table === actual.leadsTable) {
              result = leadsStore.filter((l) => vals.includes(l.id));
            } else if (table === actual.usageTable) {
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              result = usageStore.filter((u) => !bizId || u.businessId === bizId);
            }

            const promise = Promise.resolve(result);
            (promise as any).orderBy = () => promise;
            (promise as any).limit = (n: number) => {
              const lim = Promise.resolve(result.slice(0, n));
              (lim as any).offset = (o: number) => Promise.resolve(result.slice(o, o + n));
              return lim;
            };
            return promise;
          },
        }),
      }),
      insert: (table: any) => ({
        values: (item: any) => {
          const rawItems = Array.isArray(item) ? item : [item];
          const items = rawItems.map((it) => ({
            createdAt: new Date(),
            updatedAt: new Date(),
            ...it,
          }));
          const pushItems = () => {
            if (table === actual.agentsTable) agentsStore.push(...items);
            else if (table === actual.messagesTable) messagesStore.push(...items);
            else if (table === actual.callsTable) callsStore.push(...items);
            else if (table === actual.contactsTable) contactsStore.push(...items);
            else if (table === actual.leadsTable) leadsStore.push(...items);
            else if (table === actual.appointmentsTable) appointmentsStore.push(...items);
            else if (table === actual.usageTable) usageStore.push(...items);
          };
          const p = Promise.resolve(items);
          (p as any).returning = () => {
            pushItems();
            return Promise.resolve(items);
          };
          (p as any).onConflictDoNothing = () => {
            pushItems();
            const cp = Promise.resolve(items);
            (cp as any).returning = () => Promise.resolve(items);
            return cp;
          };
          return p;
        },
      }),
      update: (table: any) => ({
        set: (values: any) => ({
          where: (condition: any) => ({
            returning: () => {
              const vals = extractVals(condition);
              const bizId = vals.find((v) => typeof v === "string" && v.startsWith("business_"));
              const specificId = vals.find(
                (v) =>
                  typeof v === "string" &&
                  (v.startsWith("agent_") || v.startsWith("msg_") || v.startsWith("call_") || v.startsWith("business_")),
              );

              if (table === actual.agentsTable) {
                const target = agentsStore.find(
                  (a) => (!bizId || a.businessId === bizId) && (!specificId || a.id === specificId),
                );
                if (target) {
                  Object.assign(target, values);
                  return Promise.resolve([target]);
                }
              } else if (table === actual.messagesTable) {
                const target = messagesStore.find(
                  (m) => (!bizId || m.businessId === bizId) && (!specificId || m.id === specificId),
                );
                if (target) {
                  Object.assign(target, values);
                  return Promise.resolve([target]);
                }
              } else if (table === actual.callsTable) {
                const target = callsStore.find(
                  (c) => (!bizId || c.businessId === bizId) && (!specificId || c.id === specificId),
                );
                if (target) {
                  Object.assign(target, values);
                  return Promise.resolve([target]);
                }
              }
              return Promise.resolve([]);
            },
          }),
        }),
      }),
      transaction: async (cb: any) => cb({
        select: (_fields?: any) => ({
          from: (table: any) => ({
            where: (condition: any) => {
              const vals = extractVals(condition);
              let result: any[] = [];
              if (table === actual.agentsTable) result = agentsStore.filter((a) => vals.includes(a.id));
              else if (table === actual.businessesTable) result = businessesStore.filter((b) => vals.includes(b.id));
              const promise = Promise.resolve(result);
              (promise as any).limit = (n: number) => Promise.resolve(result.slice(0, n));
              return promise;
            },
          }),
        }),
        insert: (table: any) => ({
          values: (item: any) => {
            const rawItems = Array.isArray(item) ? item : [item];
            const items = rawItems.map((it) => ({
              createdAt: new Date(),
              updatedAt: new Date(),
              ...it,
            }));
            return {
              returning: () => {
                if (table === actual.contactsTable) contactsStore.push(...items);
                else if (table === actual.leadsTable) leadsStore.push(...items);
                else if (table === actual.callsTable) callsStore.push(...items);
                return Promise.resolve(items);
              },
            };
          },
        }),
      }),
    },
  };
});

// Import routers after the mock
import agentsRouter from "./routes/agents";
import messagesRouter from "./routes/messages";
import leadsprintRouter from "./routes/leadsprint";

function createTestApp() {
  const app = express();
  app.use(express.json());
  // Inject mock authenticated operator
  app.use((req, _res, next) => {
    req.leadSprintUserId = "user_demo";
    req.leadSprintBusinessId = "business_demo";
    next();
  });
  app.use("/api", agentsRouter);
  app.use("/api", messagesRouter);
  app.use("/api", leadsprintRouter);
  return app;
}

describe("LeadSprint AI Receptionist Platform — Step 1 & 2 Tests", () => {
  const originalEnv = { ...process.env };
  const app = createTestApp();

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      LEADSPRINT_KILL_SWITCH: "true",
    };

    // Reset stores
    agentsStore = [];
    messagesStore = [];
    callsStore = [];
    contactsStore = [];
    leadsStore = [];
    appointmentsStore = [];
    usageStore = [
      {
        id: "usage_business_demo_active",
        businessId: "business_demo",
        periodStart: new Date(Date.UTC(2020, 0, 1)),
        periodEnd: new Date(Date.UTC(2030, 11, 31)),
        voiceMinutes: "0",
        smsCount: 0,
        bookingCount: 0,
        estimatedCost: "0",
      },
    ];
    businessesStore = [
      {
        id: "business_demo",
        name: "Northstar Realty Reception Desk",
        market: "US",
        timezone: "America/New_York",
        phoneNumber: "+15550199999",
        transferNumber: "+15550198888",
        callingPaused: true,
        maxCallAttempts: 2,
        quietHours: "21:00–08:00",
      },
    ];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Retell Integration Services for Agent Sync", () => {
    it("creates Retell LLM and Agent when API key is configured", async () => {
      process.env["RETELL_API_KEY"] = "retell_test_key_123";

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ llm_id: "llm_sample_456" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ agent_id: "agent_retell_789" }),
        });
      global.fetch = fetchMock;

      const result = await createRetellAgent({
        name: "Northstar Receptionist",
        voiceId: "retell-Cimo",
        language: "en-US",
        greeting: "Hello, thank you for calling Northstar Realty.",
        prompt: "You are a professional front desk receptionist.",
      });

      expect(result.agentId).toBe("agent_retell_789");
      expect(result.llmId).toBe("llm_sample_456");
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // 1st call creates LLM
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.retellai.com/create-retell-llm");
      const llmBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(llmBody.general_prompt).toContain("front desk receptionist");
      expect(llmBody.begin_message).toContain("Northstar Realty");

      // 2nd call creates Agent
      expect(fetchMock.mock.calls[1][0]).toBe("https://api.retellai.com/create-agent");
      const agentBody = JSON.parse(fetchMock.mock.calls[1][1].body);
      expect(agentBody.agent_name).toBe("Northstar Receptionist");
      expect(agentBody.voice_id).toBe("retell-Cimo");
      expect(agentBody.response_engine.llm_id).toBe("llm_sample_456");
    });

    it("updates Retell LLM and Agent on patch", async () => {
      process.env["RETELL_API_KEY"] = "retell_test_key_123";

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ llm_id: "llm_sample_456" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => JSON.stringify({ agent_id: "agent_retell_789" }),
        });
      global.fetch = fetchMock;

      const result = await updateRetellAgent({
        agentId: "agent_retell_789",
        llmId: "llm_sample_456",
        name: "Updated Receptionist",
        prompt: "Updated instructions.",
      });

      expect(result.agentId).toBe("agent_retell_789");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.retellai.com/update-retell-llm/llm_sample_456");
      expect(fetchMock.mock.calls[1][0]).toBe("https://api.retellai.com/update-agent/agent_retell_789");
    });

    it("throws ProviderNotConfiguredError when RETELL_API_KEY is missing", async () => {
      delete process.env["RETELL_API_KEY"];

      await expect(
        createRetellAgent({
          name: "Unconfigured Agent",
          voiceId: "retell-Cimo",
        }),
      ).rejects.toThrow(/Retell is not configured/);
    });
  });

  describe("2. AI Agents Backend Endpoints", () => {
    it("GET /api/agents lists agents with tenant authorization", async () => {
      agentsStore.push({
        id: "agent_existing",
        businessId: "business_demo",
        name: "Day Receptionist",
        voiceId: "retell-Cimo",
        language: "en-US",
        isActive: true,
        syncStatus: "synced",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await supertest(app).get("/api/agents");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Day Receptionist");
    });

    it("POST /api/agents creates an agent and tracks sync status", async () => {
      delete process.env["RETELL_API_KEY"]; // test unconfigured provider behavior

      const res = await supertest(app)
        .post("/api/agents")
        .send({
          name: "Test Virtual Receptionist",
          voice_id: "retell-11labs-rachel",
          language: "en-US",
          greeting: "Good morning! How may I direct your call?",
          prompt: "You are the daytime receptionist.",
          is_active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^agent_/);
      expect(res.body.name).toBe("Test Virtual Receptionist");
      expect(res.body.sync_status).toBe("unconfigured");
      expect(res.body.is_active).toBe(true);

      const agentId = res.body.id;

      // GET by ID
      const getRes = await supertest(app).get(`/api/agents/${agentId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe("Test Virtual Receptionist");

      // PATCH update
      const patchRes = await supertest(app)
        .patch(`/api/agents/${agentId}`)
        .send({
          greeting: "Welcome to our office! How can I help?",
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.greeting).toBe("Welcome to our office! How can I help?");
    });

    it("POST /api/agents/:id/test enforces kill switch safety and blocks live calls", async () => {
      // 1. Create an agent first in store
      const agentId = "agent_test_safety";
      agentsStore.push({
        id: agentId,
        businessId: "business_demo",
        name: "Safe Test Agent",
        voiceId: "retell-Cimo",
        language: "en-US",
        isActive: true,
        syncStatus: "synced",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 2. Initiate a test call
      const testRes = await supertest(app)
        .post(`/api/agents/${agentId}/test`)
        .send({
          phone_number: "+12125550199",
          customer_name: "Safety Inspector",
        });

      expect(testRes.status).toBe(200);
      // Mandatory safety invariant: status must be policy_blocked and outcome must explicitly record safe mode
      expect(testRes.body.status).toBe("policy_blocked");
      expect(testRes.body.outcome).toContain("kill_switch / safe test mode");
      expect(testRes.body.call_type).toBe("test");
      expect(testRes.body.agent_id).toBe(agentId);
    });

    it("POST /api/calls/start returns 404 when requested agent does not exist in the workspace or belongs to another business", async () => {
      // Nonexistent agent
      const resNonexistent = await supertest(app)
        .post("/api/calls/start")
        .send({
          phone: "+12125550199",
          customer_name: "Test Caller",
          agent_id: "agent_nonexistent_999",
        });

      expect(resNonexistent.status).toBe(404);
      expect(resNonexistent.body.error).toContain("Selected agent was not found in this workspace");

      // Agent belonging to another business / workspace
      agentsStore.push({
        id: "agent_other_biz",
        businessId: "other_workspace_123",
        name: "Other Business Agent",
        voiceId: "retell-Cimo",
        language: "en-US",
        isActive: true,
        syncStatus: "synced",
        retellAgentId: "retell_agent_other",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const resOtherBiz = await supertest(app)
        .post("/api/calls/start")
        .send({
          phone: "+12125550199",
          customer_name: "Test Caller",
          agent_id: "agent_other_biz",
        });

      expect(resOtherBiz.status).toBe(404);
      expect(resOtherBiz.body.error).toContain("Selected agent was not found in this workspace");
    });

    it("POST /api/calls/start returns 400 when requested agent is unsynced or missing retellAgentId", async () => {
      const unsyncedId = "agent_unsynced_sara";
      agentsStore.push({
        id: unsyncedId,
        businessId: "business_demo",
        name: "Unsynced Sara",
        voiceId: "retell-Cimo",
        language: "en-US",
        isActive: true,
        syncStatus: "failed",
        retellAgentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await supertest(app)
        .post("/api/calls/start")
        .send({
          phone: "+12125550199",
          customer_name: "Test Caller",
          agent_id: unsyncedId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Selected agent "Unsynced Sara" is not synced with Retell');
    });

    it("POST /api/calls/start maps synced agent's retellAgentId for Retell API request", async () => {
      process.env["RETELL_API_KEY"] = "retell_test_key_live";
      process.env["LEADSPRINT_KILL_SWITCH"] = "false";
      businessesStore[0].callingPaused = false;
      businessesStore[0].quietHours = "00:00–01:00";

      const syncedAgentId = "agent_synced_sara";
      const realRetellAgentId = "retell_agent_sara_real_999";
      agentsStore.push({
        id: syncedAgentId,
        businessId: "business_demo",
        name: "Sara Live",
        voiceId: "retell-Cimo",
        language: "en-US",
        isActive: true,
        syncStatus: "synced",
        retellAgentId: realRetellAgentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ call_id: "call_retell_dispatched_123" }),
      });
      global.fetch = fetchMock;

      const res = await supertest(app)
        .post("/api/calls/start")
        .send({
          phone: "+12125550199",
          customer_name: "Test Caller",
          agent_id: syncedAgentId,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("in_progress");
      expect(res.body.agent_id).toBe(syncedAgentId);
      expect(res.body.agent_name).toBe("Sara Live");

      // Verify Retell API was called with the actual retellAgentId, NOT the internal database ID
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("https://api.retellai.com/v2/create-phone-call");
      const retellPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(retellPayload.agent_id).toBe(realRetellAgentId);
      expect(retellPayload.to_number).toBe("+12125550199");
    });

    it("PATCH /api/agents/:id maps existing retell_agent_id directly to Boomi Solutions Receptionist without calling createRetellAgent", async () => {
      process.env["RETELL_API_KEY"] = "retell_test_key_live";
      const localAgentId = "agent_local_sara_to_map";
      agentsStore.push({
        id: localAgentId,
        businessId: "business_demo",
        name: "sara",
        voiceId: "retell-Cimo",
        language: "en-US",
        isActive: true,
        syncStatus: "failed",
        retellAgentId: null,
        retellLlmId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const boomiRetellAgentId = "agent_49f28308f661ae06a348071fff";
      const boomiLlmId = "llm_8e55f477a6f9fdbf143767c30169";

      // Mock getRetellAgent call
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            agent_id: boomiRetellAgentId,
            agent_name: "Boomi Solutions Receptionist",
            voice_id: "retell-Cimo",
            language: "en-US",
            response_engine: {
              type: "retell-llm",
              llm_id: boomiLlmId,
            },
          }),
      });
      global.fetch = fetchMock;

      const res = await supertest(app)
        .patch(`/api/agents/${localAgentId}`)
        .send({
          name: "Boomi Solutions Receptionist",
          retell_agent_id: boomiRetellAgentId,
        });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(localAgentId);
      expect(res.body.name).toBe("Boomi Solutions Receptionist");
      expect(res.body.retell_agent_id).toBe(boomiRetellAgentId);
      expect(res.body.retell_llm_id).toBe(boomiLlmId);
      expect(res.body.sync_status).toBe("synced");

      // Verify it verified the agent on Retell without creating a new agent
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(`https://api.retellai.com/get-agent/${boomiRetellAgentId}`);
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("create-agent"))).toBe(false);
    });

    it("POST /api/calls/start dispatches default receptionist using Boomi Solutions Receptionist when no agent is selected", async () => {
      process.env["RETELL_API_KEY"] = "retell_test_key_live";
      process.env["RETELL_AGENT_ID"] = "agent_49f28308f661ae06a348071fff";
      process.env["LEADSPRINT_KILL_SWITCH"] = "false";
      businessesStore[0].callingPaused = false;
      businessesStore[0].quietHours = "00:00–01:00";
      businessesStore[0].retellAgentId = "retell_demo_agent"; // database contains placeholder

      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ call_id: "call_default_script_123" }),
      });
      global.fetch = fetchMock;

      const res = await supertest(app)
        .post("/api/calls/start")
        .send({
          phone: "+12125550199",
          customer_name: "Default Caller",
          // agent_id omitted -> Default Receptionist Script
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("in_progress");

      // Verify Retell API receives the active Boomi Solutions Receptionist Retell agent ID
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const retellPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(retellPayload.agent_id).toBe("agent_49f28308f661ae06a348071fff");
    });

    it("GET /api/business-settings returns Boomi Solutions Receptionist ID when database has placeholder", async () => {
      businessesStore[0].retellAgentId = "retell_demo_agent";
      process.env["RETELL_AGENT_ID"] = "agent_49f28308f661ae06a348071fff";

      const res = await supertest(app).get("/api/business-settings");
      expect(res.status).toBe(200);
      expect(res.body.retell_agent_id).toBe("agent_49f28308f661ae06a348071fff");
    });
  });

  describe("3. Receptionist Messages & Callback Requests", () => {
    it("POST /api/messages creates a callback request and GET /api/messages retrieves it", async () => {
      const createRes = await supertest(app)
        .post("/api/messages")
        .send({
          caller_name: "Arthur Dent",
          caller_phone: "+15551239876",
          caller_email: "arthur@example.com",
          reason: "Inquiring about 2-bedroom availability on Park Avenue",
          notes: "Caller requested afternoon callback",
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.id).toMatch(/^msg_/);
      expect(createRes.body.caller_name).toBe("Arthur Dent");
      expect(createRes.body.is_handled).toBe(false);

      const messageId = createRes.body.id;

      // GET /api/messages with unhandled filter
      const listRes = await supertest(app)
        .get("/api/messages?is_handled=false");
      expect(listRes.status).toBe(200);
      expect(listRes.body.some((m: any) => m.id === messageId)).toBe(true);

      // PATCH /api/messages/:id to mark handled
      const patchRes = await supertest(app)
        .patch(`/api/messages/${messageId}`)
        .send({
          is_handled: true,
          notes: "Followed up by Maya via phone.",
          assigned_to: "Maya Patel",
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.is_handled).toBe(true);
      expect(patchRes.body.assigned_to).toBe("Maya Patel");
    });
  });

  describe("4. Receptionist Call History & Overview Analytics", () => {
    it("GET /api/reports/overview returns complete analytics matching AI Receptionist Log structure", async () => {
      // Seed calls with sentiment and duration
      callsStore.push(
        {
          id: "call_1",
          businessId: "business_demo",
          callType: "inbound",
          status: "completed",
          durationSeconds: 120,
          sentiment: "positive",
          outcome: "Appointment booked",
          booked: true,
          createdAt: new Date(),
        },
        {
          id: "call_2",
          businessId: "business_demo",
          callType: "outbound",
          status: "completed",
          durationSeconds: 180,
          sentiment: "neutral",
          outcome: "Message left",
          createdAt: new Date(),
        },
      );

      // Seed messages
      messagesStore.push(
        {
          id: "msg_1",
          businessId: "business_demo",
          callerName: "John Doe",
          isHandled: false,
          createdAt: new Date(),
        },
        {
          id: "msg_2",
          businessId: "business_demo",
          callerName: "Jane Smith",
          isHandled: true,
          createdAt: new Date(),
        },
      );

      // Seed agent
      agentsStore.push({
        id: "agent_active_1",
        businessId: "business_demo",
        name: "Front Desk 1",
        isActive: true,
      });

      // Seed appointment
      appointmentsStore.push({
        id: "appt_1",
        businessId: "business_demo",
        status: "confirmed",
        startTime: new Date(),
        endTime: new Date(),
      });

      const res = await supertest(app).get("/api/reports/overview");
      expect(res.status).toBe(200);

      const overview = res.body;
      expect(overview.total_calls).toBe(2);
      expect(overview.total_duration_seconds).toBe(300);
      expect(overview.avg_duration_seconds).toBe(150);
      expect(overview.successful_calls).toBe(2);
      expect(overview.total_messages).toBe(2);
      expect(overview.unhandled_messages).toBe(1);
      expect(overview.total_bookings).toBe(1);
      expect(overview.active_agents).toBe(1);

      // Sentiment breakdown structure matches receptionist audit
      expect(overview.sentiment_breakdown).toBeDefined();
      expect(overview.sentiment_breakdown.positive).toBe(1);
      expect(overview.sentiment_breakdown.neutral).toBe(1);
      expect(overview.sentiment_breakdown.negative).toBe(0);
      expect(overview.sentiment_breakdown.mixed).toBe(0);
      expect(overview.sentiment_breakdown.unknown).toBe(0);
    });

    it("GET /api/calls supports receptionist filters (sentiment, call_type, agent_id)", async () => {
      callsStore.push({
        id: "call_test_1",
        businessId: "business_demo",
        leadId: "lead_test_1",
        contactId: "ct_test_1",
        provider: "retell",
        callType: "test",
        sentiment: "positive",
        recordingUrl: "https://example.com/rec.mp3",
        transcript: "Hello, this is a test call.",
        messageLeft: false,
        status: "completed",
        durationSeconds: 45,
        summary: "Test call completed cleanly",
        outcome: "Clean test execution",
        transferred: false,
        booked: false,
        errorState: null,
        createdAt: new Date(),
      });

      const res = await supertest(app).get("/api/calls?call_type=test");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      for (const call of res.body) {
        expect(call.call_type).toBe("test");
        expect(call).toHaveProperty("sentiment");
        expect(call).toHaveProperty("recording_url");
        expect(call).toHaveProperty("transcript");
        expect(call).toHaveProperty("message_left");
      }
    });
  });
});
