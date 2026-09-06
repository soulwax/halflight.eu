CREATE TABLE "private_music_file" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"object_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "private_music_file_object_key_unique" UNIQUE("object_key"),
	CONSTRAINT "private_music_file_size_positive" CHECK ("private_music_file"."size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "private_music_file" ADD CONSTRAINT "private_music_file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "private_music_file_user_created_idx" ON "private_music_file" USING btree ("user_id","created_at");