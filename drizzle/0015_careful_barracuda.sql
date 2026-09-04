ALTER TABLE "user_playlist" ADD COLUMN "source" text DEFAULT 'syn' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_playlist" ADD COLUMN "sync_status" text DEFAULT 'local_only' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_playlist" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_playlist" ADD COLUMN "remote_etag" text;--> statement-breakpoint
ALTER TABLE "user_playlist" ADD COLUMN "sync_error" text;