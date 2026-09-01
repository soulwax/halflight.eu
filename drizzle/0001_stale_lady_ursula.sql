CREATE TABLE "administrator" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"user_id" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "administrator_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "administrator_singleton" CHECK ("administrator"."id" = 1)
);
