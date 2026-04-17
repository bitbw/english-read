CREATE TABLE "public_library_books" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"cover_url" text,
	"blob_url" text NOT NULL,
	"blob_key" text NOT NULL,
	"file_size" integer,
	"tier" text NOT NULL,
	"tier_source" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "public_book_id" text;--> statement-breakpoint
ALTER TABLE "public_library_books" ADD CONSTRAINT "public_library_books_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_library_books_tier_idx" ON "public_library_books" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "public_library_books_uploaded_by_idx" ON "public_library_books" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "public_library_books_created_idx" ON "public_library_books" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_public_book_id_public_library_books_id_fk" FOREIGN KEY ("public_book_id") REFERENCES "public"."public_library_books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_public_book_id_idx" ON "books" USING btree ("public_book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "books_user_public_book_unique" ON "books" USING btree ("user_id","public_book_id");