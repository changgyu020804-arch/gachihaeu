CREATE TABLE `role_verification_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`requested_role` text NOT NULL,
	`document_type` text NOT NULL,
	`original_filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`object_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewer_email` text,
	`review_note` text DEFAULT '' NOT NULL,
	`reviewed_at` text,
	`evidence_delete_after` text,
	`evidence_deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `role_verification_user_created_idx` ON `role_verification_requests` (`user_email`,`created_at`);--> statement-breakpoint
CREATE INDEX `role_verification_status_created_idx` ON `role_verification_requests` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `requested_campus_role` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `role_verification_status` text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
UPDATE `user_profiles`
SET `requested_campus_role` = `campus_role`,
    `campus_role` = '',
    `role_verification_status` = 'not_submitted'
WHERE `campus_role` IN ('교수', '교직원');
