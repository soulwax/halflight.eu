CREATE TABLE "playback_operation_result" (
	"user_id" text NOT NULL,
	"operation_id" text NOT NULL,
	"result_json" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playback_operation_result_user_id_operation_id_pk" PRIMARY KEY("user_id","operation_id"),
	CONSTRAINT "playback_operation_result_operation_id_length" CHECK (char_length("playback_operation_result"."operation_id") between 1 and 128)
);
--> statement-breakpoint
ALTER TABLE "playback_state" ADD COLUMN "queue_entries_json" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE "playback_state" SET "queue_entries_json" = "queue_json";--> statement-breakpoint
ALTER TABLE "playback_operation_result" ADD CONSTRAINT "playback_operation_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playback_operation_result_user_created_idx" ON "playback_operation_result" USING btree ("user_id","created_at");
