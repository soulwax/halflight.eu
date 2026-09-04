ALTER TABLE "playback_state" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "playback_state" ADD COLUMN "last_origin" text;