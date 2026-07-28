ALTER TABLE `participants` ADD `attendance_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX `participants_attendance_idx` ON `participants` (`activity_id`,`attendance_status`);--> statement-breakpoint
ALTER TABLE `ratings` ADD `rating_type` text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `comment_hidden` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `ratings` ADD `reported_at` text;--> statement-breakpoint
CREATE INDEX `ratings_type_idx` ON `ratings` (`rated_email`,`rating_type`);