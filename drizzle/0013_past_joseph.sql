CREATE TABLE `attendance_codes` (
	`activity_id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`valid_from` text NOT NULL,
	`expires_at` text NOT NULL,
	`generated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attendance_codes_expiry_idx` ON `attendance_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `moderation_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`report_type` text NOT NULL,
	`report_id` text NOT NULL,
	`action` text NOT NULL,
	`target_email` text NOT NULL,
	`moderator_email` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `moderation_actions_report_idx` ON `moderation_actions` (`report_type`,`report_id`);--> statement-breakpoint
CREATE INDEX `moderation_actions_target_idx` ON `moderation_actions` (`target_email`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_sanctions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`kind` text NOT NULL,
	`reason` text NOT NULL,
	`expires_at` text,
	`created_by` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_sanctions_active_idx` ON `user_sanctions` (`user_email`,`revoked_at`,`expires_at`);