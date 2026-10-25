ALTER TABLE "clients" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "contact_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "email_show_rate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "email_show_gross" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "email_show_fee" boolean DEFAULT false NOT NULL;