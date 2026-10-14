CREATE TABLE IF NOT EXISTS "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL REFERENCES "businesses"("id"),
	"retell_agent_id" text,
	"retell_llm_id" text,
	"name" text NOT NULL,
	"language" text DEFAULT 'en-US' NOT NULL,
	"voice_id" text DEFAULT 'retell-Cimo' NOT NULL,
	"greeting" text DEFAULT '' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"interruption_sensitivity" numeric DEFAULT '0.9',
	"max_call_duration_ms" integer DEFAULT 3600000,
	"is_active" boolean DEFAULT true NOT NULL,
	"sync_status" text DEFAULT 'synced' NOT NULL,
	"sync_error" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agents_business_retell_unique" ON "agents" USING btree ("business_id","retell_agent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_business_idx" ON "agents" USING btree ("business_id");
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "agent_id" text REFERENCES "agents"("id");
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "agent_name" text;
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "call_type" text DEFAULT 'outbound' NOT NULL;
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "sentiment" text;
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "recording_url" text;
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "transcript" text;
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "transcript_object" jsonb;
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "disconnection_reason" text;
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "message_left" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "message_id" text;
--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "appointment_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calls_business_idx" ON "calls" USING btree ("business_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "calls_agent_idx" ON "calls" USING btree ("agent_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL REFERENCES "businesses"("id"),
	"call_id" text REFERENCES "calls"("id"),
	"contact_id" text REFERENCES "contacts"("id"),
	"caller_name" text NOT NULL,
	"caller_phone" text NOT NULL,
	"caller_email" text,
	"reason" text NOT NULL,
	"is_handled" boolean DEFAULT false NOT NULL,
	"handled_at" timestamp with time zone,
	"handled_by" text,
	"assigned_to" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_business_idx" ON "messages" USING btree ("business_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_business_handled_idx" ON "messages" USING btree ("business_id","is_handled");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_call_idx" ON "messages" USING btree ("call_id");
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "call_id" text REFERENCES "calls"("id");
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "customer_name" text;
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "customer_phone" text;
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "customer_email" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_call_idx" ON "appointments" USING btree ("call_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_business_idx" ON "appointments" USING btree ("business_id");
