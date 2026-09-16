CREATE TABLE "track_playability" (
	"track_id" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "track_playability_checked_at_idx" ON "track_playability" USING btree ("checked_at");