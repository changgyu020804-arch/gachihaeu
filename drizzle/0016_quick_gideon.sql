CREATE TABLE `maintenance_jobs` (
	`job_name` text PRIMARY KEY NOT NULL,
	`last_started_at` text NOT NULL,
	`last_completed_at` text,
	`last_deleted_rows` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notifications_read_at_idx` ON `notifications` (`read_at`);