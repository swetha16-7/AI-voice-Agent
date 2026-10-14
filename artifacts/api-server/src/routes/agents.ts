import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, ilike } from "drizzle-orm";
import {
  agentsTable,
  callsTable,
  contactsTable,
  db,
  leadsTable,
} from "@workspace/db";
import {
  CreateAgentBody,
  GetAgentParams,
  GetAgentsQueryParams,
  TestAgentBody,
  TestAgentParams,
  UpdateAgentBody,
  UpdateAgentParams,
} from "@workspace/api-zod";
import {
  createRetellAgent,
  providerConfig,
  updateRetellAgent,
} from "../lib/providers";
import { logger } from "../lib/logger";
import { sendValidatedResponse } from "./leadsprint";

const router: IRouter = Router();

export function getAgentDto(row: typeof agentsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    retell_agent_id: row.retellAgentId,
    retell_llm_id: row.retellLlmId,
    voice_id: row.voiceId,
    language: row.language,
    greeting: row.greeting,
    prompt: row.prompt,
    is_active: row.isActive,
    sync_status: row.syncStatus,
    last_synced_at: row.lastSyncedAt?.toISOString() ?? null,
    created_at: row.createdAt ? (row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString()) : new Date().toISOString(),
    updated_at: row.updatedAt ? (row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date(row.updatedAt).toISOString()) : new Date().toISOString(),
  };
}

function scopedBusinessId(req: { leadSprintBusinessId?: string }): string {
  if (req.leadSprintBusinessId) {
    return req.leadSprintBusinessId;
  }
  const demoRequested = process.env["LEADSPRINT_DEMO_AUTH"]?.trim().toLowerCase() === "true";
  if (demoRequested && process.env["NODE_ENV"] !== "production") {
    return "demo_business";
  }
  throw new Error("Missing business scope on authenticated request");
}

router.get("/agents", async (req, res): Promise<void> => {
  const businessId = scopedBusinessId(req);
  const query = GetAgentsQueryParams.safeParse(req.query);
  const search = query.success && query.data.search ? query.data.search.trim() : "";

  const conditions = [eq(agentsTable.businessId, businessId)];
  if (search) {
    conditions.push(ilike(agentsTable.name, `%${search}%`));
  }

  const rows = await db
    .select()
    .from(agentsTable)
    .where(and(...conditions))
    .orderBy(desc(agentsTable.createdAt));

  res.status(200).json(rows.map(getAgentDto));
});

router.post("/agents", async (req, res): Promise<void> => {
  const businessId = scopedBusinessId(req);
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const body = parsed.data;
  const config = providerConfig().retell;

  let retellAgentId: string | null = null;
  let retellLlmId: string | null = null;
  let syncStatus: "synced" | "pending" | "failed" | "unconfigured" = config.apiKey ? "pending" : "unconfigured";
  let lastSyncedAt: Date | null = null;

  if (config.apiKey) {
    try {
      const syncResult = await createRetellAgent({
        name: body.name,
        voiceId: body.voice_id,
        language: body.language ?? "en-US",
        greeting: body.greeting ?? null,
        prompt: body.prompt ?? null,
      });
      retellAgentId = syncResult.agentId;
      retellLlmId = syncResult.llmId ?? null;
      syncStatus = "synced";
      lastSyncedAt = new Date();
    } catch (err) {
      logger.error({ err, agentName: body.name }, "Failed to sync agent with Retell API");
      syncStatus = "failed";
    }
  }

  const agentId = `agent_${crypto.randomUUID().slice(0, 12)}`;
  const [created] = await db
    .insert(agentsTable)
    .values({
      id: agentId,
      businessId,
      name: body.name,
      retellAgentId,
      retellLlmId,
      voiceId: body.voice_id,
      language: body.language ?? "en-US",
      greeting: body.greeting ?? "",
      prompt: body.prompt ?? "",
      isActive: body.is_active ?? true,
      syncStatus,
      lastSyncedAt,
    })
    .returning();

  res.status(201).json(getAgentDto(created));
});

router.get("/agents/:id", async (req, res): Promise<void> => {
  const businessId = scopedBusinessId(req);
  const params = GetAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, params.data.id), eq(agentsTable.businessId, businessId)));

  if (!row) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.status(200).json(getAgentDto(row));
});

router.patch("/agents/:id", async (req, res): Promise<void> => {
  const businessId = scopedBusinessId(req);
  const params = UpdateAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateAgentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, params.data.id), eq(agentsTable.businessId, businessId)));

  if (!existing) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const config = providerConfig().retell;
  let syncStatus = existing.syncStatus;
  let lastSyncedAt = existing.lastSyncedAt;
  let retellAgentId = existing.retellAgentId;
  let retellLlmId = existing.retellLlmId;

  if (config.apiKey) {
    if (existing.retellAgentId) {
      try {
        await updateRetellAgent({
          agentId: existing.retellAgentId,
          llmId: existing.retellLlmId,
          name: body.data.name,
          voiceId: body.data.voice_id,
          language: body.data.language,
          greeting: body.data.greeting,
          prompt: body.data.prompt,
        });
        syncStatus = "synced";
        lastSyncedAt = new Date();
      } catch (err) {
        logger.error({ err, agentId: existing.id }, "Failed to update agent in Retell API");
        syncStatus = "failed";
      }
    } else {
      try {
        const syncResult = await createRetellAgent({
          name: body.data.name ?? existing.name,
          voiceId: body.data.voice_id ?? existing.voiceId,
          language: body.data.language ?? existing.language,
          greeting: body.data.greeting ?? existing.greeting,
          prompt: body.data.prompt ?? existing.prompt,
        });
        retellAgentId = syncResult.agentId;
        retellLlmId = syncResult.llmId ?? null;
        syncStatus = "synced";
        lastSyncedAt = new Date();
      } catch (err) {
        logger.error({ err, agentId: existing.id }, "Failed to create agent in Retell API during sync");
        syncStatus = "failed";
      }
    }
  }

  const [updated] = await db
    .update(agentsTable)
    .set({
      name: body.data.name ?? existing.name,
      voiceId: body.data.voice_id ?? existing.voiceId,
      language: body.data.language ?? existing.language,
      greeting: body.data.greeting !== undefined ? body.data.greeting : existing.greeting,
      prompt: body.data.prompt !== undefined ? body.data.prompt : existing.prompt,
      isActive: body.data.is_active !== undefined ? body.data.is_active : existing.isActive,
      retellAgentId,
      retellLlmId,
      syncStatus,
      lastSyncedAt,
      updatedAt: new Date(),
    })
    .where(and(eq(agentsTable.id, existing.id), eq(agentsTable.businessId, businessId)))
    .returning();

  res.status(200).json(getAgentDto(updated));
});

router.post("/agents/:id/test", async (req, res): Promise<void> => {
  const businessId = scopedBusinessId(req);
  const params = TestAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = TestAgentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [agent] = await db
    .select()
    .from(agentsTable)
    .where(and(eq(agentsTable.id, params.data.id), eq(agentsTable.businessId, businessId)));

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  // Safety invariant: Do not make live calls when kill switch or calling paused is active.
  const callId = `call_${crypto.randomUUID().slice(0, 12)}`;
  const contactId = `contact_${crypto.randomUUID().slice(0, 12)}`;
  const leadId = `lead_${crypto.randomUUID().slice(0, 12)}`;

  await db.insert(contactsTable).values({
    id: contactId,
    businessId,
    name: body.data.customer_name || `Test Caller (${agent.name})`,
    phone: body.data.phone_number,
  });

  await db.insert(leadsTable).values({
    id: leadId,
    businessId,
    contactId,
    source: "Agent Test",
    campaign: `Test: ${agent.name}`,
    project: "Test Mode",
    propertyType: "Not specified",
    budgetLabel: "Not specified",
    location: "Not specified",
    timeline: "Not specified",
    intentScore: 50,
    score: "warm",
    status: "new",
    nextAction: "Agent test call initiated",
  });

  const [testCall] = await db
    .insert(callsTable)
    .values({
      id: callId,
      businessId,
      contactId,
      leadId,
      provider: "Retell",
      idempotencyKey: `test_${callId}`,
      status: "policy_blocked",
      callType: "test",
      agentId: agent.id,
      agentName: agent.name,
      summary: `Test call initiated for agent "${agent.name}" to ${body.data.phone_number}.`,
      outcome: "Blocked — kill_switch / safe test mode",
      errorState: "Safe mode: live calls prevented by policy",
    })
    .returning();

  res.status(200).json({
    id: testCall.id,
    lead_id: testCall.leadId,
    lead_name: body.data.customer_name || `Test Caller (${agent.name})`,
    phone: body.data.phone_number,
    provider: testCall.provider,
    status: testCall.status,
    started_at: null,
    ended_at: null,
    duration_seconds: null,
    summary: testCall.summary,
    outcome: testCall.outcome,
    transferred: false,
    booked: false,
    error_state: testCall.errorState,
    agent_id: testCall.agentId,
    agent_name: testCall.agentName,
    call_type: testCall.callType,
    sentiment: null,
    recording_url: null,
    transcript: null,
    disconnection_reason: null,
    message_left: false,
    message_id: null,
    appointment_id: null,
  });
});

export default router;
