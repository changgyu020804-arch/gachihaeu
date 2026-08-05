CREATE TABLE `activity_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`author_email` text NOT NULL,
	`content` text NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`is_pinned` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_comments_activity_created_idx` ON `activity_comments` (`activity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `activity_comments_author_idx` ON `activity_comments` (`author_email`);--> statement-breakpoint
CREATE TABLE `comment_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`reporter_email` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `activity_comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_reports_comment_reporter_idx` ON `comment_reports` (`comment_id`,`reporter_email`);--> statement-breakpoint
CREATE INDEX `comment_reports_comment_idx` ON `comment_reports` (`comment_id`);--> statement-breakpoint
PRAGMA optimize;
