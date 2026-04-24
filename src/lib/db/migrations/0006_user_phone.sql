ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");