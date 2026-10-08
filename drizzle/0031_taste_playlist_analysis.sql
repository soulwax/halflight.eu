CREATE TABLE "taste_playlist_analysis" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listening_preferences" ADD COLUMN "learn_from_playlists" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "taste_playlist_analysis" ADD CONSTRAINT "taste_playlist_analysis_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "taste_playlist_analysis_next_run_idx" ON "taste_playlist_analysis" USING btree ("next_run_at");