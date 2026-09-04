ALTER TABLE "administrator" DROP CONSTRAINT "administrator_singleton";--> statement-breakpoint
ALTER TABLE "administrator" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "administrator" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "administrator" ADD COLUMN "role" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "administrator" ADD CONSTRAINT "administrator_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;