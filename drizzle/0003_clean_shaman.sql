CREATE TABLE IF NOT EXISTS "user_playlist" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"items_json" text DEFAULT '[]' NOT NULL,
	"tidal_playlist_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tidal_auth" ALTER COLUMN "secret" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tidal_auth" ADD COLUMN IF NOT EXISTS "playback_secret" text;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_playlist" ADD CONSTRAINT "user_playlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
