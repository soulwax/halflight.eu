CREATE TABLE "listening_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"autoplay" boolean DEFAULT true NOT NULL,
	"autoplay_count" integer DEFAULT 10 NOT NULL,
	"personalize_suggestions" boolean DEFAULT true NOT NULL,
	"learn_from_listening" boolean DEFAULT true NOT NULL,
	"use_lastfm_history" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listening_preferences_autoplay_count" CHECK ("listening_preferences"."autoplay_count" between 5 and 25)
);
--> statement-breakpoint
ALTER TABLE "listening_preferences" ADD CONSTRAINT "listening_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;