ALTER TABLE "playback_state" ALTER COLUMN "current_time" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "playback_state" ADD COLUMN "position_playing" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "playback_state" ADD COLUMN "position_updated_at" timestamp with time zone;