CREATE TABLE "playback_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"current_track_json" text,
	"queue_json" text DEFAULT '[]' NOT NULL,
	"history_json" text DEFAULT '[]' NOT NULL,
	"current_time" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playback_state" ADD CONSTRAINT "playback_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;