ALTER TABLE "administrator" DROP CONSTRAINT IF EXISTS "administrator_singleton";--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS administrator_id_seq;--> statement-breakpoint
ALTER TABLE "administrator" ALTER COLUMN "id" SET DEFAULT nextval('administrator_id_seq');--> statement-breakpoint
ALTER SEQUENCE administrator_id_seq OWNED BY "administrator"."id";--> statement-breakpoint
SELECT setval('administrator_id_seq', COALESCE((SELECT MAX(id) FROM "administrator"), 0) + 1, false);--> statement-breakpoint
ALTER TABLE "administrator" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "administrator" ADD CONSTRAINT "administrator_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;