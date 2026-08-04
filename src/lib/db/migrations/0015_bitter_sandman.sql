CREATE TABLE "announcements" (
		"id" text PRIMARY KEY NOT NULL,
		"title_zh" text NOT NULL,
		"title_en" text,
		"content_zh" text NOT NULL,
		"content_en" text,
		"link_url" text,
		"link_label_zh" text,
		"link_label_en" text,
		"priority" integer DEFAULT 0 NOT NULL,
		"status" text DEFAULT 'draft' NOT NULL,
		"created_by" text NOT NULL,
		"published_at" timestamp,
		"expires_at" timestamp,
		"created_at" timestamp DEFAULT now() NOT NULL,
		"updated_at" timestamp DEFAULT now() NOT NULL
	);
	--> statement-breakpoint
	ALTER TABLE "users" ADD COLUMN "article_level" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
	ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
	CREATE INDEX "announcements_status_idx" ON "announcements" USING btree ("status");--> statement-breakpoint
	CREATE INDEX "announcements_priority_idx" ON "announcements" USING btree ("priority","status");--> statement-breakpoint
	CREATE INDEX "announcements_published_at_idx" ON "announcements" USING btree ("published_at");--> statement-breakpoint
	CREATE INDEX "announcements_created_by_idx" ON "announcements" USING btree ("created_by");