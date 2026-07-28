CREATE TABLE `user_blocks` (
	`blocker_email` text NOT NULL,
	`blocked_email` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`blocker_email`, `blocked_email`)
);
--> statement-breakpoint
CREATE INDEX `user_blocks_blocked_idx` ON `user_blocks` (`blocked_email`);--> statement-breakpoint
CREATE TABLE `user_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_email` text NOT NULL,
	`reported_email` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_reports_pair_idx` ON `user_reports` (`reporter_email`,`reported_email`);--> statement-breakpoint
CREATE INDEX `user_reports_reported_idx` ON `user_reports` (`reported_email`);--> statement-breakpoint
ALTER TABLE `activities` ADD `notice` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `notice_updated_at` text;--> statement-breakpoint
ALTER TABLE `activities` ADD `cancellation_deadline_minutes` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `cancellation_reason` text DEFAULT '' NOT NULL;