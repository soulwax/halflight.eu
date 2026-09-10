CREATE TABLE "tidal_cache_object" (
	"object_key" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tidal_cache_object_expires_at_idx" ON "tidal_cache_object" USING btree ("expires_at");