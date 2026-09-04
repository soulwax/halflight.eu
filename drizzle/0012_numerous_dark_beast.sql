CREATE TABLE "lastfm_connection" (
	"user_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"session_key" text NOT NULL,
	"scrobble_enabled" boolean DEFAULT true NOT NULL,
	"now_playing_enabled" boolean DEFAULT true NOT NULL,
	"last_scrobbled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tidal_auth" ADD COLUMN "user_id" text;--> statement-breakpoint
-- The old singleton necessarily belonged to Syn's permanent administrator.
-- Retain it for that account before converting to per-user credentials.
UPDATE "tidal_auth"
SET "user_id" = "administrator"."user_id"
FROM "administrator"
WHERE "tidal_auth"."id" = 1 AND "administrator"."id" = 1;--> statement-breakpoint
-- The original owner used Syn's synthetic local email before public email
-- verification existed. Keep that account usable after enforcing verification.
UPDATE "user"
SET "email_verified" = true
FROM "administrator"
WHERE "user"."id" = "administrator"."user_id";--> statement-breakpoint
ALTER TABLE "tidal_auth" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tidal_auth" DROP CONSTRAINT "tidal_auth_pkey";--> statement-breakpoint
ALTER TABLE "tidal_auth" DROP CONSTRAINT "tidal_auth_singleton";--> statement-breakpoint
ALTER TABLE "tidal_auth" ADD CONSTRAINT "tidal_auth_pkey" PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "lastfm_connection" ADD CONSTRAINT "lastfm_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tidal_auth" ADD CONSTRAINT "tidal_auth_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tidal_auth" DROP COLUMN "id";
