CREATE TABLE `push_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`platform` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `push_tokens_user_enabled_idx` ON `push_tokens` (`user_email`,`enabled`);--> statement-breakpoint
CREATE INDEX `push_tokens_last_seen_idx` ON `push_tokens` (`last_seen_at`);