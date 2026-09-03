CREATE TABLE IF NOT EXISTS "streaming_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"preferred_quality" text DEFAULT 'HIGH' NOT NULL,
	"volume" integer DEFAULT 100 NOT NULL,
	"loudness_normalization" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "streaming_settings_quality" CHECK ("streaming_settings"."preferred_quality" in ('LOW', 'HIGH', 'LOSSLESS')),
	CONSTRAINT "streaming_settings_volume" CHECK ("streaming_settings"."volume" between 0 and 100)
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "streaming_settings" ADD CONSTRAINT "streaming_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
