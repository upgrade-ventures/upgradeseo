CREATE TABLE IF NOT EXISTS `organization_provider_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`provider` text NOT NULL,
	`secret_ciphertext` text NOT NULL,
	`public_identifier` text,
	`secret_last_four` text DEFAULT '' NOT NULL,
	`created_by_user_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `organization_provider_keys_org_provider_uidx` ON `organization_provider_keys` (`organization_id`,`provider`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `competitor_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`competitor_id` text NOT NULL,
	`url` text NOT NULL,
	`languages` text,
	`slug` text,
	`title` text,
	`h1` text,
	FOREIGN KEY (`competitor_id`) REFERENCES `competitor_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `competitor_pages_competitor_url_uidx` ON `competitor_pages` (`competitor_id`,`url`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `competitor_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`domain` text NOT NULL,
	`crawl_id` text,
	`harvested_at` text,
	`truncated` integer DEFAULT false NOT NULL,
	`unavailable` integer DEFAULT false NOT NULL,
	`targets_markets` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `competitor_profiles_project_domain_uidx` ON `competitor_profiles` (`project_id`,`domain`);