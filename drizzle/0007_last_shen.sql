CREATE TABLE `auth_codes` (
	`email` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
DELETE FROM `ratings`
WHERE `rater_email` = 'admin@uos.ac.kr' OR `rated_email` = 'admin@uos.ac.kr';
--> statement-breakpoint
DELETE FROM `notifications`
WHERE `user_email` = 'admin@uos.ac.kr'
   OR `activity_id` IN (
     SELECT `id` FROM `activities` WHERE `creator_email` = 'admin@uos.ac.kr'
   );
--> statement-breakpoint
DELETE FROM `reports`
WHERE `activity_id` IN (
  SELECT `id` FROM `activities` WHERE `creator_email` = 'admin@uos.ac.kr'
);
--> statement-breakpoint
DELETE FROM `user_reports`
WHERE `reporter_email` = 'admin@uos.ac.kr' OR `reported_email` = 'admin@uos.ac.kr';
--> statement-breakpoint
DELETE FROM `user_blocks`
WHERE `blocker_email` = 'admin@uos.ac.kr' OR `blocked_email` = 'admin@uos.ac.kr';
--> statement-breakpoint
DELETE FROM `participants`
WHERE `user_email` = 'admin@uos.ac.kr'
   OR `activity_id` IN (
     SELECT `id` FROM `activities` WHERE `creator_email` = 'admin@uos.ac.kr'
   );
--> statement-breakpoint
DELETE FROM `waitlist`
WHERE `user_email` = 'admin@uos.ac.kr'
   OR `activity_id` IN (
     SELECT `id` FROM `activities` WHERE `creator_email` = 'admin@uos.ac.kr'
   );
--> statement-breakpoint
DELETE FROM `activities` WHERE `creator_email` = 'admin@uos.ac.kr';
--> statement-breakpoint
DELETE FROM `user_profiles` WHERE `email` = 'admin@uos.ac.kr';
