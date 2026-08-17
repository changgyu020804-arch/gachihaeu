CREATE TABLE `account_security_state` (
	`subject_hash` text PRIMARY KEY NOT NULL,
	`session_version` integer DEFAULT 1 NOT NULL,
	`sanction_kind` text,
	`sanction_expires_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `moderation_alert_deliveries` (
	`report_type` text NOT NULL,
	`report_id` text NOT NULL,
	`alert_kind` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`report_type`, `report_id`, `alert_kind`)
);
--> statement-breakpoint
CREATE INDEX `moderation_alert_deliveries_created_idx` ON `moderation_alert_deliveries` (`created_at`);