CREATE TYPE "public"."week_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "payment_platforms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payment_platforms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"company" text NOT NULL,
	"fee_percent" numeric(12, 2) DEFAULT 0 NOT NULL,
	"fee_flat" numeric(12, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clients_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"contact_email" text NOT NULL,
	"cc_email" text,
	"billing_hour" numeric(12, 2) NOT NULL,
	"payment_platform_id" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "projects_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"client_id" integer,
	"description" text,
	"billing_hour" numeric(12, 2),
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_client_or_rate_check" CHECK ("projects"."client_id" is not null or "projects"."billing_hour" is not null)
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "weeks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"start_date" date NOT NULL,
	"status" "week_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_records" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "work_records_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"week_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"client_id" integer,
	"description" text NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_records_hours_check" CHECK ("work_records"."hours" > 0 and "work_records"."hours" <= 24)
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"record_id" integer,
	"date" date NOT NULL,
	"project_id" integer,
	"project_name_snapshot" text NOT NULL,
	"description" text NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text NOT NULL,
	"week_id" integer NOT NULL,
	"client_id" integer,
	"client_name_snapshot" text NOT NULL,
	"contact_email_snapshot" text DEFAULT '' NOT NULL,
	"cc_email_snapshot" text,
	"platform_company_snapshot" text,
	"fee_percent" numeric(12, 2) DEFAULT 0 NOT NULL,
	"fee_flat" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total_hours" numeric(5, 2) DEFAULT 0 NOT NULL,
	"gross" numeric(12, 2) DEFAULT 0 NOT NULL,
	"fee_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"net" numeric(12, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT 'Alex Morgan' NOT NULL,
	"weekly_target_hours" numeric(5, 2) DEFAULT 40 NOT NULL,
	"currency_symbol" text DEFAULT '$' NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_payment_platform_id_payment_platforms_id_fk" FOREIGN KEY ("payment_platform_id") REFERENCES "public"."payment_platforms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_records" ADD CONSTRAINT "work_records_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_records" ADD CONSTRAINT "work_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_records" ADD CONSTRAINT "work_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_platforms_company_idx" ON "payment_platforms" USING btree ("company");--> statement-breakpoint
CREATE INDEX "clients_name_idx" ON "clients" USING btree ("name");--> statement-breakpoint
CREATE INDEX "clients_payment_platform_id_idx" ON "clients" USING btree ("payment_platform_id");--> statement-breakpoint
CREATE INDEX "projects_client_id_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weeks_start_date_key" ON "weeks" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "work_records_week_id_idx" ON "work_records" USING btree ("week_id");--> statement-breakpoint
CREATE INDEX "work_records_project_id_idx" ON "work_records" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "work_records_date_idx" ON "work_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "invoices_week_id_idx" ON "invoices" USING btree ("week_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_week_client_uq" ON "invoices" USING btree ("week_id","client_id") WHERE "invoices"."client_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_week_no_client_uq" ON "invoices" USING btree ("week_id") WHERE "invoices"."client_id" is null;