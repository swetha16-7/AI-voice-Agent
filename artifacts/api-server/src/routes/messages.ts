import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, messagesTable } from "@workspace/db";
import {
  CreateMessageBody,
  GetMessageParams,
  GetMessagesQueryParams,
  UpdateMessageBody,
  UpdateMessageParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

export function getMessageDto(row: typeof messagesTable.$inferSelect) {
  return {
    id: row.id,
    call_id: row.callId,
    contact_id: row.contactId,
    caller_name: row.callerName,
    caller_phone: row.callerPhone,
    caller_email: row.callerEmail,
    reason: row.reason,
    is_handled: row.isHandled,
    notes: row.notes,
    assigned_to: row.assignedTo,
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

router.get("/messages", async (req, res): Promise<void> => {
  const businessId = scopedBusinessId(req);
  const query = GetMessagesQueryParams.safeParse(req.query);

  const conditions = [eq(messagesTable.businessId, businessId)];

  if (query.success) {
    if (query.data.is_handled !== undefined) {
      conditions.push(eq(messagesTable.isHandled, query.data.is_handled));
    }
    if (query.data.search && query.data.search.trim()) {
      const term = `%${query.data.search.trim()}%`;
      conditions.push(
        or(
          ilike(messagesTable.callerName, term),
          ilike(messagesTable.callerPhone, term),
          ilike(messagesTable.reason, term),
          ilike(messagesTable.notes, term),
        )!,
      );
    }
  }

  let queryBuilder = db
    .select()
    .from(messagesTable)
    .where(and(...conditions))
    .orderBy(desc(messagesTable.createdAt));

  if (query.success && query.data.limit) {
    queryBuilder = (queryBuilder as any).limit(query.data.limit);
  }
  if (query.success && query.data.offset) {
    queryBuilder = (queryBuilder as any).offset(query.data.offset);
  }

  const rows = await queryBuilder;

  res.status(200).json(rows.map(getMessageDto));
});

router.post("/messages", async (req, res): Promise<void> => {
  const businessId = scopedBusinessId(req);
  const parsed = CreateMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const body = parsed.data;
  const messageId = `msg_${crypto.randomUUID().slice(0, 12)}`;

  const [created] = await db
    .insert(messagesTable)
    .values({
      id: messageId,
      businessId,
      callId: body.call_id ?? null,
      contactId: body.contact_id ?? null,
      callerName: body.caller_name,
      callerPhone: body.caller_phone,
      callerEmail: body.caller_email ?? null,
      reason: body.reason,
      isHandled: false,
      notes: body.notes ?? null,
      assignedTo: body.assigned_to ?? null,
    })
    .returning();

  res.status(201).json(getMessageDto(created));
});

router.get("/messages/:id", async (req, res): Promise<void> => {
  const businessId = scopedBusinessId(req);
  const params = GetMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.id, params.data.id), eq(messagesTable.businessId, businessId)));

  if (!row) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  res.status(200).json(getMessageDto(row));
});

router.patch("/messages/:id", async (req, res): Promise<void> => {
  const businessId = scopedBusinessId(req);
  const params = UpdateMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(messagesTable)
    .where(and(eq(messagesTable.id, params.data.id), eq(messagesTable.businessId, businessId)));

  if (!existing) {
    res.status(404).json({ error: "Message not found" });
    return;
  }

  const [updated] = await db
    .update(messagesTable)
    .set({
      isHandled: body.data.is_handled !== undefined ? body.data.is_handled : existing.isHandled,
      notes: body.data.notes !== undefined ? body.data.notes : existing.notes,
      assignedTo: body.data.assigned_to !== undefined ? body.data.assigned_to : existing.assignedTo,
      updatedAt: new Date(),
    })
    .where(and(eq(messagesTable.id, existing.id), eq(messagesTable.businessId, businessId)))
    .returning();

  res.status(200).json(getMessageDto(updated));
});

export default router;
