CREATE TABLE `auth_codes` (
	`email` text NOT NULL,
	`code` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_codes_email_idx` ON `auth_codes` (`email`);--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`rater_email` text NOT NULL,
	`rated_email` text NOT NULL,
	`trust_score` integer NOT NULL,
	`skill_score` integer NOT NULL,
	`manner_score` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ratings_unique_idx` ON `ratings` (`activity_id`,`rater_email`,`rated_email`);--> statement-breakpoint
CREATE INDEX `ratings_rated_idx` ON `ratings` (`rated_email`);--> statement-breakpoint
CREATE INDEX `ratings_activity_idx` ON `ratings` (`activity_id`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`nickname` text DEFAULT '' NOT NULL,
	`department` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`preferred_sports` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `waitlist` (
	`activity_id` text NOT NULL,
	`user_email` text NOT NULL,
	`display_name` text NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`queued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`activity_id`, `user_email`),
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `waitlist_activity_position_idx` ON `waitlist` (`activity_id`,`position`);--> statement-breakpoint
ALTER TABLE `activities` ADD `facility_reserved` integer DEFAULT 0 NOT NULL;