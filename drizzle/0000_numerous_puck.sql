CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_email` text NOT NULL,
	`creator_name` text NOT NULL,
	`sport` text NOT NULL,
	`title` text NOT NULL,
	`venue` text NOT NULL,
	`starts_at` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`capacity` integer NOT NULL,
	`level` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activities_starts_at_idx` ON `activities` (`starts_at`);--> statement-breakpoint
CREATE INDEX `activities_creator_idx` ON `activities` (`creator_email`);--> statement-breakpoint
CREATE INDEX `activities_status_idx` ON `activities` (`status`);--> statement-breakpoint
CREATE TABLE `participants` (
	`activity_id` text NOT NULL,
	`user_email` text NOT NULL,
	`display_name` text NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`activity_id`, `user_email`),
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `participants_user_idx` ON `participants` (`user_email`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`reporter_email` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_activity_reporter_idx` ON `reports` (`activity_id`,`reporter_email`);