CREATE INDEX `activities_status_starts_idx` ON `activities` (`status`,`starts_at`);--> statement-breakpoint
CREATE INDEX `participants_activity_joined_idx` ON `participants` (`activity_id`,`joined_at`);--> statement-breakpoint
CREATE INDEX `waitlist_activity_status_position_idx` ON `waitlist` (`activity_id`,`status`,`position`);