CREATE TABLE `security_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`subject_hash` text NOT NULL,
	`ip_hash` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `security_audit_logs_created_idx` ON `security_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `security_audit_logs_event_idx` ON `security_audit_logs` (`event_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `security_rate_limits` (
	`action` text NOT NULL,
	`key_hash` text NOT NULL,
	`window_bucket` integer NOT NULL,
	`request_count` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`action`, `key_hash`, `window_bucket`)
);
--> statement-breakpoint
CREATE INDEX `security_rate_limits_updated_idx` ON `security_rate_limits` (`updated_at`);