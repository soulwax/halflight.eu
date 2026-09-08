ALTER TABLE "playback_state" ADD COLUMN "active_device_id" text;--> statement-breakpoint
ALTER TABLE "playback_state" ADD COLUMN "active_device_origin" text;--> statement-breakpoint
ALTER TABLE "playback_state" ADD COLUMN "active_device_expires_at" timestamp with time zone;