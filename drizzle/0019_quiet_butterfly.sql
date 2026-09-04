CREATE TABLE "generation_cooldown" (
	"user_id" text NOT NULL,
	"track_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_cooldown_user_id_track_id_pk" PRIMARY KEY("user_id","track_id")
);
--> statement-breakpoint
ALTER TABLE "generation_cooldown" ADD CONSTRAINT "generation_cooldown_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_cooldown_user_expiry_idx" ON "generation_cooldown" USING btree ("user_id","expires_at");