CREATE TABLE "daily_articles" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_url" text,
	"content" text NOT NULL,
	"word_count" integer,
	"published_at" timestamp,
	"source_url" text NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_articles_slug_level_unique" ON "daily_articles" USING btree ("slug","level");--> statement-breakpoint
CREATE INDEX "daily_articles_published_at_idx" ON "daily_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "daily_articles_level_idx" ON "daily_articles" USING btree ("level");--> statement-breakpoint
CREATE INDEX "daily_articles_created_at_idx" ON "daily_articles" USING btree ("created_at");