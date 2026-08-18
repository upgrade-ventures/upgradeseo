CREATE TABLE IF NOT EXISTS "organization_provider_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"secret_ciphertext" text NOT NULL,
	"public_identifier" text,
	"secret_last_four" text DEFAULT '' NOT NULL,
	"created_by_user_id" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competitor_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"competitor_id" text NOT NULL,
	"url" text NOT NULL,
	"languages" text,
	"slug" text,
	"title" text,
	"h1" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "competitor_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"domain" text NOT NULL,
	"crawl_id" text,
	"harvested_at" text,
	"truncated" boolean DEFAULT false NOT NULL,
	"unavailable" boolean DEFAULT false NOT NULL,
	"targets_markets" text DEFAULT '[]' NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_provider_keys" ADD CONSTRAINT "organization_provider_keys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_provider_keys" ADD CONSTRAINT "organization_provider_keys_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_pages" ADD CONSTRAINT "competitor_pages_competitor_id_competitor_profiles_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitor_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_profiles" ADD CONSTRAINT "competitor_profiles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organization_provider_keys_org_provider_uidx" ON "organization_provider_keys" USING btree ("organization_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "competitor_pages_competitor_url_uidx" ON "competitor_pages" USING btree ("competitor_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "competitor_profiles_project_domain_uidx" ON "competitor_profiles" USING btree ("project_id","domain");