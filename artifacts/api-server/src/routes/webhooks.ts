import crypto from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  activitiesTable,
  appointmentsTable,
  businessesTable,
  callsTable,
  consentEventsTable,
  contactsTable,
  db,
  leadsTable,
  providerEventsTable,
  usageTable,
  workflowJobsTable,
} from "@workspace/db";
import {
  providerConfig,
  verifyRetellSignature,
  verifyTwilioSignature,
  verifyWebhookSignature,
} from "../lib/providers";
import { normalizeToE164, inferTimezoneFromPhone, isValidIanaTimezone, validateConsentSource, parseConsentTimestamp } from "../lib/phone";
import { getActiveUsageRow } from "../lib/usage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

export const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000; // 5 minutes

export function verifyTimestampFreshness(
  timestampValue: string | number | undefined | null,
  maxAgeMs = MAX_WEBHOOK_AGE_MS,
): { valid: boolean; reason?: string } {
  if (timestampValue === undefined || timestampValue === null) {
    return { valid: false, reason: "Missing timestamp" };
  }

  if (typeof timestampValue === "string" && timestampValue.trim() === "") {
    return { valid: false, reason: "Missing timestamp" };
  }

  let tsMs: number;
  if (typeof timestampValue === "number") {
    if (isNaN(timestampValue) || !isFinite(timestampValue)) {
      return { valid: false, reason: "Unparseable timestamp number" };
    }
    tsMs = timestampValue < 10000000000 ? timestampValue * 1000 : timestampValue;
  } else if (typeof timestampValue === "string") {
    const trimmed = timestampValue.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const num = Number(trimmed);
      if (isNaN(num) || !isFinite(num)) {
        return { valid: false, reason: "Unparseable timestamp string" };
      }
      tsMs = num < 10000000000 ? num * 1000 : num;
    } else {
      const parsed = Date.parse(trimmed);
      if (isNaN(parsed)) {
        return { valid: false, reason: "Unparseable timestamp string" };
      }
      tsMs = parsed;
    }
  } else {
    return { valid: false, reason: "Invalid timestamp type" };
  }

  const ageMs = Math.abs(Date.now() - tsMs);
  if (ageMs > maxAgeMs) {
    return { valid: false, reason: `Timestamp outside freshness window (${Math.round(ageMs / 1000)}s old)` };
  }
  return { valid: true };
}

function rawBody(req: Request): Buffer | undefined {
  return (req as Request & { rawBody?: Buffer }).rawBody;
}

function eventId(req: Request, body: Record<string, unknown>): string {
  const candidate =
    (typeof body.event_id === "string" && body.event_id) ||
    (typeof body.id === "string" && body.id) ||
    req.get("x-event-id") ||
    undefined;
  const raw = rawBody(req) ?? Buffer.from(JSON.stringify(body ?? {}));
  return candidate ?? crypto.createHash("sha256").update(raw).digest("hex");
}

async function acceptProviderEvent(
  input: {
    businessId: string;
    provider: string;
    externalEventId: string;
    eventType: string;
    payload: Record<string, unknown>;
  },
  dbOrTx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0] = db,
): Promise<boolean> {
  const payloadHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(input.payload))
    .digest("hex");
  const [created] = await dbOrTx
    .insert(providerEventsTable)
    .values({
      id: `event_${crypto.randomUUID().slice(0, 12)}`,
      businessId: input.businessId,
      provider: input.provider,
      externalEventId: input.externalEventId,
      payloadHash,
      eventType: input.eventType,
      payload: input.payload,
      processedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [
        providerEventsTable.provider,
        providerEventsTable.externalEventId,
      ],
    })
    .returning({ id: providerEventsTable.id });
  return Boolean(created);
}

function signatureFor(req: Request): string | undefined {
  return (
    req.get("x-cal-signature-256") ??
    req.get("x-calcom-signature") ??
    req.get("x-retell-signature") ??
    req.get("x-leadsprint-signature")
  );
}

router.post("/webhooks/intake", async (req, res): Promise<void> => {
  const config = providerConfig();
  const raw = rawBody(req);
  if (!raw || !verifyWebhookSignature(raw, signatureFor(req), config.intakeWebhookSecret)) {
    res.status(401).json({ error: "Invalid intake signature" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const tsCandidate = body.timestamp ?? body.created_at ?? req.get("x-timestamp");
  const freshness = verifyTimestampFreshness(tsCandidate as string | number | undefined);
  if (!freshness.valid) {
    res.status(400).json({ error: `Stale webhook: ${freshness.reason}` });
    return;
  }

  const businessId = typeof body.business_id === "string" ? body.business_id : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const rawPhone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!businessId || !name || !rawPhone) {
    res.status(400).json({ error: "business_id, name, and phone are required" });
    return;
  }

  const normalizedPhone = normalizeToE164(rawPhone);
  if (!normalizedPhone.valid) {
    res.status(400).json({ error: `Invalid phone number: ${normalizedPhone.error}` });
    return;
  }
  const phone = normalizedPhone.e164;

  const [business] = await db.select({ id: businessesTable.id }).from(businessesTable).where(eq(businessesTable.id, businessId)).limit(1);
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const rawEventId = eventId(req, body);
  const namespacedEventId = `${businessId}:${rawEventId}`;

  let result: { accepted: boolean; duplicate?: boolean; re_engaged?: boolean; lead_id?: string } = { accepted: false };

  const hasAffirmativeConsent =
    body.consent_given === true ||
    body.consentGiven === true ||
    body.consent_given === "true";

  let consentCapturedAt: Date | null = null;
  let consentSource: string | null = null;
  let consentDisclosureVersion: string | null = null;
  let disclosureText: string | null = null;

  if (hasAffirmativeConsent) {
    const tsResult = parseConsentTimestamp(body.consent_captured_at ?? null);
    if (tsResult.invalid) {
      res.status(400).json({ error: "consent_captured_at is invalid; supply a valid ISO 8601 timestamp or omit the field" });
      return;
    }
    consentCapturedAt = tsResult.date;

    const rawSource = typeof body.consent_source === "string" ? body.consent_source : null;
    const validatedSource = validateConsentSource(rawSource, "api_intake");
    if (validatedSource === null) {
      res.status(400).json({ error: `consent_source '${rawSource}' is not a recognised canonical value` });
      return;
    }
    consentSource = validatedSource;

    consentDisclosureVersion = (typeof body.consent_disclosure_version === "string" && body.consent_disclosure_version.trim()) ? body.consent_disclosure_version.trim() : null;
    disclosureText = (typeof body.disclosure_text === "string" && body.disclosure_text.trim()) ? body.disclosure_text.trim() : null;
  }

  const intakeIp = ((req.ip || (req.get("x-forwarded-for")?.split(",")[0]?.trim()) || null) ?? null) as string | null;

  let recipientTimezone: string | null = null;
  let timezoneProvenance: "explicit_intake" | "area_code_inferred" | "business_fallback" = "business_fallback";

  const rawTzField = typeof body.recipient_timezone === "string" ? body.recipient_timezone.trim()
    : (typeof body.timezone === "string" ? body.timezone.trim() : "");

  if (rawTzField) {
    if (isValidIanaTimezone(rawTzField)) {
      recipientTimezone = rawTzField;
      timezoneProvenance = "explicit_intake";
    } else {
      const inferred = inferTimezoneFromPhone(phone);
      recipientTimezone = inferred.timezone;
      timezoneProvenance = inferred.provenance;
    }
  } else {
    const inferred = inferTimezoneFromPhone(phone);
    recipientTimezone = inferred.timezone;
    timezoneProvenance = inferred.provenance;
  }

  const explicitIntentScore =
    typeof body.intent_score === "number" && !isNaN(body.intent_score) && body.intent_score >= 0 && body.intent_score <= 100
      ? Math.round(body.intent_score)
      : typeof body.intentScore === "number" && !isNaN(body.intentScore) && body.intentScore >= 0 && body.intentScore <= 100
        ? Math.round(body.intentScore)
        : undefined;

  await db.transaction(async (tx) => {
    const accepted = await acceptProviderEvent({
      businessId,
      provider: "LeadIntake",
      externalEventId: namespacedEventId,
      eventType: "lead_intake",
      payload: body,
    }, tx);

    if (!accepted) {
      result = { accepted: true, duplicate: true };
      return;
    }

    const [existingContact] = await tx
      .select()
      .from(contactsTable)
      .where(and(eq(contactsTable.businessId, businessId), eq(contactsTable.phone, phone)))
      .limit(1);

    let contactId: string;
    if (!existingContact) {
      contactId = `contact_${crypto.randomUUID().slice(0, 12)}`;
      await tx.insert(contactsTable).values({
        id: contactId,
        businessId,
        name,
        phone,
        email: typeof body.email === "string" ? body.email : null,
        consentStatus: "valid",
        consentCapturedAt,
        consentSource,
        consentDisclosureVersion,
        intakeIp,
        recipientTimezone,
        timezoneProvenance,
      });

      if (hasAffirmativeConsent) {
        await tx.insert(consentEventsTable).values({
          id: `consent_${crypto.randomUUID().slice(0, 12)}`,
          businessId,
          contactId,
          eventType: "opt_in",
          source: consentSource ?? "api_intake",
          disclosureVersion: consentDisclosureVersion,
          disclosureText,
          ipAddress: intakeIp,
          userAgent: req.get("user-agent") || null,
          metadata: {},
          capturedAt: consentCapturedAt ?? new Date(),
        });
      }

      const leadId = `lead_${crypto.randomUUID().slice(0, 12)}`;
      const leadValues: any = {
        id: leadId,
        businessId,
        contactId,
        source: typeof body.source === "string" ? body.source : "webhook",
        campaign: typeof body.campaign === "string" ? body.campaign : "Inbound enquiry",
        project: typeof body.project === "string" ? body.project : "Configured project",
        propertyType: typeof body.property_type === "string" ? body.property_type : "Not specified",
        budgetLabel: typeof body.budget_label === "string" ? body.budget_label : "Not specified",
        location: typeof body.location === "string" ? body.location : "Not specified",
        timeline: typeof body.timeline === "string" ? body.timeline : "Not specified",
        score: "warm",
        status: "new",
        nextAction: "Call lead",
      };
      if (explicitIntentScore !== undefined) {
        leadValues.intentScore = explicitIntentScore;
      }

      await tx.insert(leadsTable).values(leadValues);
      await tx.insert(activitiesTable).values({
        id: `activity_${crypto.randomUUID().slice(0, 12)}`,
        businessId,
        type: "intake",
        title: `New lead received for ${name}`,
        detail: "Authenticated intake webhook accepted",
      });

      const callId = `call_${crypto.randomUUID().slice(0, 12)}`;
      const jobId = `job_${crypto.randomUUID().slice(0, 12)}`;
      const idempotencyKey = `intake_call_${leadId}`;

      await tx.insert(callsTable).values({
        id: callId,
        businessId,
        contactId,
        leadId,
        provider: "Retell",
        idempotencyKey,
        status: "queued",
        summary: "Call queued for the approved qualification script.",
        outcome: "Queued",
      });

      await tx.insert(workflowJobsTable).values({
        id: jobId,
        businessId,
        type: "initiate_call",
        idempotencyKey,
        status: "queued",
        availableAt: new Date(),
      });

      result = { accepted: true, lead_id: leadId, re_engaged: false };
    } else {
      contactId = existingContact.id;
      await tx
        .update(contactsTable)
        .set({
          name: name || existingContact.name,
          email: typeof body.email === "string" ? body.email : existingContact.email,
          intakeIp: intakeIp ?? existingContact.intakeIp,
          recipientTimezone: recipientTimezone ?? existingContact.recipientTimezone,
          timezoneProvenance: timezoneProvenance ?? existingContact.timezoneProvenance,
          ...(hasAffirmativeConsent
            ? {
                consentCapturedAt: consentCapturedAt ?? existingContact.consentCapturedAt,
                consentSource: consentSource ?? existingContact.consentSource,
                consentDisclosureVersion: consentDisclosureVersion ?? existingContact.consentDisclosureVersion,
              }
            : {}),
        })
        .where(eq(contactsTable.id, contactId));

      if (hasAffirmativeConsent) {
        await tx.insert(consentEventsTable).values({
          id: `consent_${crypto.randomUUID().slice(0, 12)}`,
          businessId,
          contactId,
          eventType: "opt_in",
          source: consentSource ?? "api_intake",
          disclosureVersion: consentDisclosureVersion,
          disclosureText,
          ipAddress: intakeIp,
          userAgent: req.get("user-agent") || null,
          metadata: {},
          capturedAt: consentCapturedAt ?? new Date(),
        });
      }

      const existingLeads = await tx
        .select()
        .from(leadsTable)
        .where(and(eq(leadsTable.businessId, businessId), eq(leadsTable.contactId, contactId)))
        .orderBy(desc(leadsTable.createdAt));

      const activeLead = existingLeads.find((l) => ["new", "contacted", "qualified"].includes(l.status));
      let targetLeadId: string;

      if (activeLead) {
        targetLeadId = activeLead.id;
        const updateValues: any = {
          status: "new",
          nextAction: "Call lead",
          updatedAt: new Date(),
          campaign: typeof body.campaign === "string" ? body.campaign : activeLead.campaign,
          project: typeof body.project === "string" ? body.project : activeLead.project,
          propertyType: typeof body.property_type === "string" ? body.property_type : activeLead.propertyType,
          budgetLabel: typeof body.budget_label === "string" ? body.budget_label : activeLead.budgetLabel,
          location: typeof body.location === "string" ? body.location : activeLead.location,
          timeline: typeof body.timeline === "string" ? body.timeline : activeLead.timeline,
        };
        if (explicitIntentScore !== undefined) {
          updateValues.intentScore = explicitIntentScore;
        }
        await tx.update(leadsTable).set(updateValues).where(eq(leadsTable.id, activeLead.id));
      } else {
        targetLeadId = `lead_${crypto.randomUUID().slice(0, 12)}`;
        const newLeadValues: any = {
          id: targetLeadId,
          businessId,
          contactId,
          source: typeof body.source === "string" ? body.source : "webhook",
          campaign: typeof body.campaign === "string" ? body.campaign : "Inbound enquiry",
          project: typeof body.project === "string" ? body.project : "Configured project",
          propertyType: typeof body.property_type === "string" ? body.property_type : "Not specified",
          budgetLabel: typeof body.budget_label === "string" ? body.budget_label : "Not specified",
          location: typeof body.location === "string" ? body.location : "Not specified",
          timeline: typeof body.timeline === "string" ? body.timeline : "Not specified",
          score: "warm",
          status: "new",
          nextAction: "Call lead",
        };
        if (explicitIntentScore !== undefined) {
          newLeadValues.intentScore = explicitIntentScore;
        }
        await tx.insert(leadsTable).values(newLeadValues);
      }

      await tx.insert(activitiesTable).values({
        id: `activity_${crypto.randomUUID().slice(0, 12)}`,
        businessId,
        type: "intake",
        title: `Re-engaged lead received for ${name}`,
        detail: "Authenticated intake webhook re-engagement accepted",
      });

      const callId = `call_${crypto.randomUUID().slice(0, 12)}`;
      const jobId = `job_${crypto.randomUUID().slice(0, 12)}`;
      const idempotencyKey = `intake_call_${targetLeadId}_${Date.now()}`;

      await tx.insert(callsTable).values({
        id: callId,
        businessId,
        contactId,
        leadId: targetLeadId,
        provider: "Retell",
        idempotencyKey,
        status: "queued",
        summary: "Call queued for the approved qualification script.",
        outcome: "Queued",
      });

      await tx.insert(workflowJobsTable).values({
        id: jobId,
        businessId,
        type: "initiate_call",
        idempotencyKey,
        status: "queued",
        availableAt: new Date(),
      });

      result = { accepted: true, lead_id: targetLeadId, re_engaged: true };
    }
  });

  if (result.duplicate) {
    res.status(200).json({ accepted: true, duplicate: true });
    return;
  }

  res.status(201).json(result);
});

function parseRetellTimestamp(ts: unknown): Date | null {
  if (ts === null || ts === undefined) return null;
  if (typeof ts === "number" && !isNaN(ts) && ts > 0) {
    const tsMs = ts < 10000000000 ? ts * 1000 : ts;
    return new Date(tsMs);
  }
  if (typeof ts === "string" && ts.trim()) {
    const num = Number(ts.trim());
    if (!isNaN(num) && num > 0) {
      const tsMs = num < 10000000000 ? num * 1000 : num;
      return new Date(tsMs);
    }
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseRetellDurationSeconds(callObj: Record<string, unknown>, body: Record<string, unknown>): number | undefined {
  const durationMs =
    typeof callObj.duration_ms === "number"
      ? callObj.duration_ms
      : typeof body.duration_ms === "number"
      ? body.duration_ms
      : undefined;
  if (durationMs !== undefined && !isNaN(durationMs)) {
    return Math.max(0, Math.round(durationMs / 1000));
  }
  return undefined;
}

router.post("/webhooks/retell", async (req, res): Promise<void> => {
  let eventType = "call_update";
  let businessId = "";
  let callId = "";

  try {
    const config = providerConfig();
    const signature = req.get("x-retell-signature") ?? signatureFor(req);
    const primarySecret = config.retell.apiKey || config.retell.webhookSecret;
    const fallbackSecret =
      config.retell.apiKey && config.retell.webhookSecret && config.retell.webhookSecret !== config.retell.apiKey
        ? config.retell.webhookSecret
        : undefined;

    const raw = rawBody(req);
    let usedSecretSource = config.retell.apiKey ? "RETELL_API_KEY" : "RETELL_WEBHOOK_SECRET";
    let verification = verifyRetellSignature(raw, signature, primarySecret);
    if (!verification.valid && fallbackSecret) {
      const fallbackVerification = verifyRetellSignature(raw, signature, fallbackSecret);
      if (fallbackVerification.valid) {
        verification = fallbackVerification;
        usedSecretSource = "RETELL_WEBHOOK_SECRET";
      }
    }

    if (!verification.valid) {
      logger.warn(
        {
          hasSignature: Boolean(signature),
          rawBodyLength: raw ? raw.length : 0,
          parsedTimestampAgeMs: verification.timestamp ? Math.abs(Date.now() - verification.timestamp) : undefined,
          secretSource: primarySecret ? usedSecretSource : "none",
          reason: verification.reason,
        },
        "Retell webhook signature verification failed",
      );
      res.status(401).json({ error: "Invalid Retell signature" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const tsCandidate = body.event_timestamp ?? body.timestamp ?? req.get("x-timestamp") ?? verification.timestamp;
    const freshness = verifyTimestampFreshness(tsCandidate as string | number | undefined);
    if (!freshness.valid) {
      res.status(400).json({ error: `Stale webhook: ${freshness.reason}` });
      return;
    }

    const callObj = (body.call && typeof body.call === "object" ? body.call : {}) as Record<string, unknown>;

    callId =
      (typeof callObj.call_id === "string" && callObj.call_id) ||
      (typeof callObj.callId === "string" && callObj.callId) ||
      (typeof body.call_id === "string" && body.call_id) ||
      (typeof body.callId === "string" && body.callId) ||
      "";

    const rawMetadata =
      (callObj.metadata && typeof callObj.metadata === "object" ? callObj.metadata : undefined) ??
      (body.metadata && typeof body.metadata === "object" ? body.metadata : {});
    const metadata = rawMetadata as Record<string, unknown>;

    businessId = typeof metadata.business_id === "string" ? metadata.business_id : "";
    const metadataCallId = typeof metadata.call_id === "string" ? metadata.call_id : "";

    // Allow correctly signed Retell dashboard Test request without metadata.business_id
    if (!businessId) {
      res.status(200).json({ accepted: true, test: true });
      return;
    }

    if (!callId) {
      res.status(400).json({ error: "call_id and metadata.business_id are required" });
      return;
    }

    eventType =
      typeof body.event === "string"
        ? body.event
        : typeof body.triggerEvent === "string"
        ? body.triggerEvent
        : "call_update";

    const explicitEventId =
      (typeof body.event_id === "string" && body.event_id) ||
      (typeof body.id === "string" && body.id) ||
      req.get("x-retell-event-id") ||
      req.get("x-event-id") ||
      undefined;

    const retellExternalEventId = explicitEventId || (callId ? `${eventType}:${callId}` : eventId(req, body));

    let result = { accepted: true, duplicate: false };

    await db.transaction(async (tx) => {
      const accepted = await acceptProviderEvent(
        {
          businessId,
          provider: "Retell",
          externalEventId: retellExternalEventId,
          eventType,
          payload: body,
        },
        tx,
      );

      if (!accepted) {
        result = { accepted: true, duplicate: true };
        return;
      }

      const [business] = await tx
        .select({ id: businessesTable.id })
        .from(businessesTable)
        .where(eq(businessesTable.id, businessId))
        .limit(1);

      if (!business) {
        logger.warn({ businessId, callId }, "Retell webhook business tenant not found");
        return;
      }

      const rawStatus =
        typeof callObj.call_status === "string"
          ? callObj.call_status
          : typeof body.call_status === "string"
          ? body.call_status
          : typeof callObj.status === "string"
          ? callObj.status
          : typeof body.status === "string"
          ? body.status
          : "";

      const terminalEvents = ["call_ended", "call_analyzed"];
      const terminalStatuses = ["ended", "call_ended", "completed", "call_analyzed"];
      const isTerminal = terminalEvents.includes(eventType) || terminalStatuses.includes(rawStatus);

      const durationSeconds = parseRetellDurationSeconds(callObj, body);
      const disconnectionReason =
        typeof callObj.disconnection_reason === "string"
          ? callObj.disconnection_reason
          : typeof body.disconnection_reason === "string"
          ? body.disconnection_reason
          : undefined;

      const eventStartedAt = parseRetellTimestamp(
        callObj.start_timestamp ?? body.start_timestamp ?? (eventType === "call_started" ? tsCandidate : undefined),
      );
      const eventEndedAt = parseRetellTimestamp(
        callObj.end_timestamp ?? body.end_timestamp ?? (isTerminal ? tsCandidate : undefined),
      );

      const transferAttempted =
        callObj.transfer_attempted === true ||
        typeof callObj.transfer_to_number === "string" ||
        body.transfer_attempted === true ||
        typeof body.transfer_to_number === "string";
      const transferSucceeded =
        callObj.transferred === true ||
        callObj.transfer_successful === true ||
        body.transferred === true ||
        body.transfer_successful === true;
      const failedTransferReasons = ["dial_failed", "dial_no_answer", "dial_busy", "voicemail_reached", "transfer_failed"];
      const transferFailed = transferAttempted && !transferSucceeded && (disconnectionReason ? failedTransferReasons.includes(disconnectionReason) : true);

      const rawAnalysis = callObj.call_analysis ?? body.call_analysis;
      const summaryCandidate =
        typeof rawAnalysis === "string"
          ? rawAnalysis
          : typeof (rawAnalysis as any)?.call_summary === "string"
          ? (rawAnalysis as any).call_summary
          : typeof callObj.summary === "string"
          ? callObj.summary
          : typeof body.summary === "string"
          ? body.summary
          : undefined;

      // 1. Locate existing call record
      let [callRow] = await tx
        .select()
        .from(callsTable)
        .where(and(eq(callsTable.businessId, businessId), eq(callsTable.providerCallId, callId)));

      if (!callRow && metadataCallId) {
        const [orphanCall] = await tx
          .select()
          .from(callsTable)
          .where(and(eq(callsTable.businessId, businessId), eq(callsTable.id, metadataCallId)));
        if (orphanCall) {
          callRow = orphanCall;
        }
      }

      // 2. If call does NOT exist, provision call row when tenant and lead/contact context is available
      if (!callRow) {
        const metadataLeadId = typeof metadata.lead_id === "string" ? metadata.lead_id : "";
        let resolvedContactId: string | null = null;
        let resolvedLeadId: string | null = null;

        if (metadataLeadId) {
          const [existingLead] = await tx
            .select()
            .from(leadsTable)
            .where(and(eq(leadsTable.businessId, businessId), eq(leadsTable.id, metadataLeadId)));
          if (existingLead) {
            resolvedLeadId = existingLead.id;
            resolvedContactId = existingLead.contactId;
          }
        }

        if (!resolvedLeadId || !resolvedContactId) {
          const rawPhone =
            (typeof callObj.customer_number === "string" && callObj.customer_number) ||
            (typeof callObj.to_number === "string" && callObj.to_number) ||
            (typeof callObj.from_number === "string" && callObj.from_number) ||
            (typeof body.to_number === "string" && body.to_number) ||
            (typeof body.from_number === "string" && body.from_number) ||
            "";

          const normalized = rawPhone ? normalizeToE164(rawPhone) : null;
          const phoneToUse = normalized && normalized.valid ? normalized.e164 : (rawPhone || "+10000000000");

          const [existingContact] = await tx
            .select()
            .from(contactsTable)
            .where(and(eq(contactsTable.businessId, businessId), eq(contactsTable.phone, phoneToUse)));

          if (existingContact) {
            resolvedContactId = existingContact.id;
            const [latestLead] = await tx
              .select()
              .from(leadsTable)
              .where(and(eq(leadsTable.businessId, businessId), eq(leadsTable.contactId, existingContact.id)))
              .orderBy(desc(leadsTable.createdAt))
              .limit(1);
            if (latestLead) {
              resolvedLeadId = latestLead.id;
            }
          }

          if (!resolvedContactId) {
            const newContactId = `contact_${crypto.randomUUID().slice(0, 12)}`;
            await tx.insert(contactsTable).values({
              id: newContactId,
              businessId,
              name: "Inbound Caller",
              phone: phoneToUse,
            });
            resolvedContactId = newContactId;
          }

          if (!resolvedLeadId && resolvedContactId) {
            const newLeadId = `lead_${crypto.randomUUID().slice(0, 12)}`;
            await tx.insert(leadsTable).values({
              id: newLeadId,
              businessId,
              contactId: resolvedContactId,
              source: "Retell Inbound",
              campaign: "Inbound Call",
              project: "Inbound Project",
              propertyType: "Not specified",
              budgetLabel: "Not specified",
              location: "Not specified",
              timeline: "Not specified",
              intentScore: 50,
              score: "warm",
              status: isTerminal ? "contacted" : "in_progress",
              nextAction: isTerminal ? "Review call summary" : "Inbound call active",
            });
            resolvedLeadId = newLeadId;
          }
        }

        if (resolvedContactId && resolvedLeadId) {
          const newCallId = metadataCallId || `call_${crypto.randomUUID().slice(0, 12)}`;
          const initialStatus = isTerminal
            ? rawStatus === "failed" || disconnectionReason === "error"
              ? "failed"
              : "completed"
            : "in_progress";

          const [insertedCall] = await tx
            .insert(callsTable)
            .values({
              id: newCallId,
              businessId,
              contactId: resolvedContactId,
              leadId: resolvedLeadId,
              provider: "Retell",
              providerCallId: callId,
              idempotencyKey: `retell_${callId}`,
              status: initialStatus,
              startedAt: eventStartedAt ?? (eventType === "call_started" ? new Date() : undefined),
              endedAt: isTerminal ? eventEndedAt ?? new Date() : undefined,
              durationSeconds: durationSeconds,
              summary: summaryCandidate ?? (isTerminal ? "Retell call completed." : "Live Retell call started."),
              outcome: transferFailed
                ? "Transfer failed — message captured for manual follow-up"
                : disconnectionReason ?? (isTerminal ? "Completed" : "In progress"),
              transferred: transferAttempted ? transferSucceeded : false,
              errorState: rawStatus === "failed" ? "Retell reported a failed call" : transferFailed ? "transfer_failed" : undefined,
            })
            .onConflictDoNothing()
            .returning();

          if (insertedCall) {
            callRow = insertedCall;
          }
        }
      }

      // 3. If callRow exists (pre-existing or provisioned), update it monotonically
      if (callRow) {
        let finalStatus: string;
        if (eventType === "call_started") {
          // Monotonic: if already completed or failed, do NOT regress to in_progress
          finalStatus = ["completed", "failed"].includes(callRow.status) ? callRow.status : "in_progress";
        } else if (eventType === "call_ended") {
          finalStatus = rawStatus === "failed" || disconnectionReason === "error" ? "failed" : "completed";
        } else if (eventType === "call_analyzed") {
          finalStatus = callRow.status === "failed" || rawStatus === "failed" ? "failed" : "completed";
        } else {
          finalStatus = isTerminal
            ? rawStatus === "failed" || disconnectionReason === "error"
              ? "failed"
              : "completed"
            : ["completed", "failed"].includes(callRow.status)
            ? callRow.status
            : "in_progress";
        }

        const finalStartedAt = eventStartedAt ?? callRow.startedAt ?? (eventType === "call_started" ? new Date() : undefined);
        const finalEndedAt = eventEndedAt ?? (isTerminal ? callRow.endedAt ?? new Date() : callRow.endedAt);
        const finalDuration = durationSeconds ?? callRow.durationSeconds;
        const finalSummary = summaryCandidate ?? callRow.summary;
        const finalOutcome = transferFailed
          ? "Transfer failed — message captured for manual follow-up"
          : disconnectionReason ?? (isTerminal && callRow.outcome === "Queued" ? "Completed" : callRow.outcome);
        const finalErrorState =
          finalStatus === "failed"
            ? "Retell reported a failed call"
            : transferFailed
            ? "transfer_failed"
            : callRow.errorState;

        await tx
          .update(callsTable)
          .set({
            status: finalStatus,
            startedAt: finalStartedAt,
            endedAt: finalEndedAt,
            durationSeconds: finalDuration,
            providerCallId: callId,
            transferred: transferAttempted ? transferSucceeded : callRow.transferred,
            summary: finalSummary,
            outcome: finalOutcome,
            errorState: finalErrorState,
          })
          .where(and(eq(callsTable.businessId, businessId), eq(callsTable.id, callRow.id)));

        if (isTerminal) {
          await tx
            .update(workflowJobsTable)
            .set({
              status: "completed",
              lockedAt: null,
              lockedBy: null,
              leaseExpiresAt: null,
              lastError: null,
            })
            .where(
              and(
                eq(workflowJobsTable.businessId, businessId),
                eq(workflowJobsTable.idempotencyKey, callRow.id),
              ),
            );
        }

        // Usage update: avoid double-counting on multiple webhook events for the same call
        if (durationSeconds != null && durationSeconds > 0) {
          const previousRecordedDuration = callRow.durationSeconds ?? 0;
          const incrementalSeconds = Math.max(0, durationSeconds - previousRecordedDuration);
          if (incrementalSeconds > 0) {
            const activeUsage = await getActiveUsageRow(businessId, new Date(), tx);
            await tx
              .update(usageTable)
              .set({
                voiceMinutes: sql`${usageTable.voiceMinutes} + ${incrementalSeconds / 60}`,
                estimatedCost: sql`${usageTable.estimatedCost} + ${(incrementalSeconds / 60) * 0.12}`,
              })
              .where(eq(usageTable.id, activeUsage.id));
          }
        }

        if (transferFailed) {
          await tx.insert(activitiesTable).values({
            id: `activity_${crypto.randomUUID().slice(0, 12)}`,
            businessId,
            type: "message",
            title: "Transfer failed — message captured",
            detail: `Call ${callId}: human transfer did not connect (${disconnectionReason ?? "unknown reason"}). Caller's message/callback request needs manual follow-up.`,
          });
          await tx
            .update(leadsTable)
            .set({
              nextAction: "Call back — transfer to human did not connect",
              updatedAt: new Date(),
            })
            .where(and(eq(leadsTable.id, callRow.leadId), eq(leadsTable.businessId, businessId)));
        }
      }
    });

    res.status(202).json(result);
  } catch (err) {
    logger.error({ err, eventType, businessId, callId }, "Failed to process Retell webhook event");
    res.status(500).json({ error: "Failed to process Retell event" });
    return;
  }
});

router.post("/webhooks/twilio/status", async (req, res): Promise<void> => {
  const config = providerConfig();
  const twilioSignatureValid = verifyTwilioSignature(
    `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    req.body as Record<string, unknown>,
    req.get("x-twilio-signature"),
    config.twilio.authToken,
  );
  const signedBodyValid = verifyWebhookSignature(rawBody(req), signatureFor(req), config.twilio.webhookSecret);
  if (!twilioSignatureValid && !signedBodyValid) {
    res.status(401).json({ error: "Invalid Twilio signature" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const tsCandidate = body.Timestamp ?? req.get("x-twilio-timestamp");
  const freshness = verifyTimestampFreshness(tsCandidate as string | number | undefined);
  if (!freshness.valid) {
    res.status(400).json({ error: `Stale webhook: ${freshness.reason}` });
    return;
  }

  const callId = typeof body.CallSid === "string" ? body.CallSid : "";
  const [callRow] = callId
    ? await db.select({ businessId: callsTable.businessId }).from(callsTable).where(eq(callsTable.providerCallId, callId)).limit(1)
    : [];
  const businessId = typeof body.BusinessId === "string" ? body.BusinessId : callRow?.businessId;
  if (!callId || !businessId) {
    res.status(400).json({ error: "CallSid must match a known LeadSprint call" });
    return;
  }
  const accepted = await acceptProviderEvent({ businessId, provider: "Twilio", externalEventId: eventId(req, body), eventType: typeof body.CallStatus === "string" ? body.CallStatus : "status", payload: body });
  if (accepted) {
    const status = typeof body.CallStatus === "string" ? body.CallStatus : "unknown";
    await db.update(callsTable).set({
      providerCallId: callId,
      status: status === "completed" ? "completed" : status === "failed" || status === "busy" || status === "no-answer" ? "failed" : "in_progress",
      endedAt: status === "completed" || status === "failed" || status === "busy" || status === "no-answer" ? new Date() : undefined,
      errorState: status === "failed" || status === "busy" || status === "no-answer" ? `Twilio reported ${status}` : undefined,
    }).where(and(eq(callsTable.businessId, businessId), eq(callsTable.providerCallId, callId)));
  }
  res.status(202).json({ accepted: true, duplicate: !accepted });
});

router.post("/webhooks/calcom", async (req, res): Promise<void> => {
  const config = providerConfig();
  if (!verifyWebhookSignature(rawBody(req), signatureFor(req), config.calcom.webhookSecret)) {
    res.status(401).json({ error: "Invalid Cal.com signature" });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;
  const tsCandidate = body.createdAt ?? payload.createdAt ?? req.get("x-timestamp");
  const freshness = verifyTimestampFreshness(tsCandidate as string | number | undefined);
  if (!freshness.valid) {
    res.status(400).json({ error: `Stale webhook: ${freshness.reason}` });
    return;
  }

  const metadata = (body.metadata && typeof body.metadata === "object" ? body.metadata : {}) as Record<string, unknown>;
  const payloadMetadata = (payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}) as Record<string, unknown>;
  const businessId =
    (typeof metadata.business_id === "string" && metadata.business_id) ||
    (typeof payloadMetadata.business_id === "string" && payloadMetadata.business_id) ||
    "";
  if (!businessId) {
    res.status(400).json({ error: "metadata.business_id is required" });
    return;
  }

  const triggerEvent = typeof body.triggerEvent === "string" ? body.triggerEvent : "";
  const externalEventId = eventId(req, body);

  const accepted = await acceptProviderEvent({
    businessId,
    provider: "Cal.com",
    externalEventId,
    eventType: triggerEvent || "booking",
    payload: body,
  });

  if (!accepted) {
    res.status(202).json({ accepted: true, duplicate: true });
    return;
  }

  const uidCandidate = payload.uid ?? payload.bookingId ?? payload.id ?? body.uid;
  const uid = uidCandidate != null ? String(uidCandidate).trim() : "";

  switch (triggerEvent) {
    case "BOOKING_CONFIRMED":
    case "BOOKING_CREATED": {
      if (!uid) {
        logger.warn({ triggerEvent, businessId }, "Cal.com webhook missing booking uid");
        break;
      }
      try {
        await db.transaction(async (tx) => {
          const [appointment] = await tx
            .select()
            .from(appointmentsTable)
            .where(
              and(
                eq(appointmentsTable.businessId, businessId),
                eq(appointmentsTable.externalId, uid),
              ),
            )
            .limit(1);

          if (!appointment) {
            logger.warn(
              { businessId, uid, triggerEvent },
              "Cal.com webhook appointment not found for tenant",
            );
            return;
          }

          await tx
            .update(appointmentsTable)
            .set({ status: "confirmed" })
            .where(eq(appointmentsTable.id, appointment.id));
        });
      } catch (err) {
        logger.error(
          { err, triggerEvent, businessId, uid },
          "Failed to process Cal.com webhook lifecycle reconciliation",
        );
        await db
          .delete(providerEventsTable)
          .where(
            and(
              eq(providerEventsTable.provider, "Cal.com"),
              eq(providerEventsTable.externalEventId, externalEventId),
            ),
          );
        res.status(500).json({ error: "Failed to process Cal.com event" });
        return;
      }
      break;
    }

    case "BOOKING_RESCHEDULED": {
      if (!uid) {
        logger.warn({ triggerEvent, businessId }, "Cal.com webhook missing booking uid");
        break;
      }
      try {
        await db.transaction(async (tx) => {
          const [appointment] = await tx
            .select()
            .from(appointmentsTable)
            .where(
              and(
                eq(appointmentsTable.businessId, businessId),
                eq(appointmentsTable.externalId, uid),
              ),
            )
            .limit(1);

          if (!appointment) {
            logger.warn(
              { businessId, uid, triggerEvent },
              "Cal.com webhook appointment not found for tenant",
            );
            return;
          }

          let newStart: Date | undefined;
          let newEnd: Date | undefined;

          if (payload.startTime && typeof payload.startTime === "string") {
            const parsed = new Date(payload.startTime);
            if (!isNaN(parsed.getTime())) {
              newStart = parsed;
            }
          }
          if (payload.endTime && typeof payload.endTime === "string") {
            const parsed = new Date(payload.endTime);
            if (!isNaN(parsed.getTime())) {
              newEnd = parsed;
            }
          }

          if (!newStart || !newEnd) {
            logger.warn(
              { uid, payloadStartTime: payload.startTime, payloadEndTime: payload.endTime },
              "BOOKING_RESCHEDULED missing valid startTime or endTime; preserving existing times",
            );
          }

          const finalStart = newStart ?? appointment.startTime;
          const finalEnd = newEnd ?? appointment.endTime;

          await tx
            .update(appointmentsTable)
            .set({
              startTime: finalStart,
              endTime: finalEnd,
              status: "confirmed",
            })
            .where(eq(appointmentsTable.id, appointment.id));

          await tx
            .update(leadsTable)
            .set({
              nextAction: "Appointment rescheduled",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(leadsTable.id, appointment.leadId),
                eq(leadsTable.businessId, businessId),
              ),
            );

          await tx.insert(activitiesTable).values({
            id: `activity_${crypto.randomUUID().slice(0, 12)}`,
            businessId,
            type: "booking",
            title: "Appointment rescheduled",
            detail: `Showing rescheduled for ${finalStart.toISOString()}.`,
          });
        });
      } catch (err) {
        logger.error(
          { err, triggerEvent, businessId, uid },
          "Failed to process Cal.com webhook lifecycle reconciliation",
        );
        await db
          .delete(providerEventsTable)
          .where(
            and(
              eq(providerEventsTable.provider, "Cal.com"),
              eq(providerEventsTable.externalEventId, externalEventId),
            ),
          );
        res.status(500).json({ error: "Failed to process Cal.com event" });
        return;
      }
      break;
    }

    case "BOOKING_CANCELLED": {
      if (!uid) {
        logger.warn({ triggerEvent, businessId }, "Cal.com webhook missing booking uid");
        break;
      }
      try {
        await db.transaction(async (tx) => {
          const [appointment] = await tx
            .select()
            .from(appointmentsTable)
            .where(
              and(
                eq(appointmentsTable.businessId, businessId),
                eq(appointmentsTable.externalId, uid),
              ),
            )
            .limit(1);

          if (!appointment) {
            logger.warn(
              { businessId, uid, triggerEvent },
              "Cal.com webhook appointment not found for tenant",
            );
            return;
          }

          await tx
            .update(appointmentsTable)
            .set({ status: "cancelled" })
            .where(eq(appointmentsTable.id, appointment.id));

          await tx
            .update(leadsTable)
            .set({
              nextAction: "Reschedule showing",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(leadsTable.id, appointment.leadId),
                eq(leadsTable.businessId, businessId),
              ),
            );

          await tx.insert(activitiesTable).values({
            id: `activity_${crypto.randomUUID().slice(0, 12)}`,
            businessId,
            type: "booking",
            title: "Appointment cancelled",
            detail: `Cal.com booking ${uid} was cancelled.`,
          });
        });
      } catch (err) {
        logger.error(
          { err, triggerEvent, businessId, uid },
          "Failed to process Cal.com webhook lifecycle reconciliation",
        );
        await db
          .delete(providerEventsTable)
          .where(
            and(
              eq(providerEventsTable.provider, "Cal.com"),
              eq(providerEventsTable.externalEventId, externalEventId),
            ),
          );
        res.status(500).json({ error: "Failed to process Cal.com event" });
        return;
      }
      break;
    }

    default: {
      logger.info({ triggerEvent, businessId }, "Unhandled Cal.com event type received");
      break;
    }
  }

  res.status(202).json({ accepted: true, duplicate: false });
});

export default router;