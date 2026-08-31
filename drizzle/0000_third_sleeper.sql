CREATE TABLE "task" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tidal_auth" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"secret" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tidal_auth_singleton" CHECK ("tidal_auth"."id" = 1)
);
