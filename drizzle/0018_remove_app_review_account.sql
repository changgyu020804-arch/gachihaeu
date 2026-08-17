-- Custom SQL migration file, put your code below! --
DELETE FROM `moderation_alert_deliveries`
WHERE (`report_type` = 'activity' AND `report_id` IN (
  SELECT r.id FROM reports r
  LEFT JOIN activities a ON a.id = r.activity_id
  WHERE r.reporter_email LIKE '%@review.gachihaeu.com'
     OR a.creator_email LIKE '%@review.gachihaeu.com'
))
OR (`report_type` = 'comment' AND `report_id` IN (
  SELECT cr.id FROM comment_reports cr
  LEFT JOIN activity_comments c ON c.id = cr.comment_id
  LEFT JOIN activities a ON a.id = c.activity_id
  WHERE cr.reporter_email LIKE '%@review.gachihaeu.com'
     OR c.author_email LIKE '%@review.gachihaeu.com'
     OR a.creator_email LIKE '%@review.gachihaeu.com'
))
OR (`report_type` = 'user' AND `report_id` IN (
  SELECT id FROM user_reports
  WHERE reporter_email LIKE '%@review.gachihaeu.com'
     OR reported_email LIKE '%@review.gachihaeu.com'
))
OR (`report_type` = 'rating' AND `report_id` IN (
  SELECT id FROM ratings
  WHERE rater_email LIKE '%@review.gachihaeu.com'
     OR rated_email LIKE '%@review.gachihaeu.com'
));
--> statement-breakpoint
DELETE FROM `moderation_actions`
WHERE target_email LIKE '%@review.gachihaeu.com'
   OR moderator_email LIKE '%@review.gachihaeu.com'
   OR (report_type = 'activity' AND report_id IN (
     SELECT r.id FROM reports r
     LEFT JOIN activities a ON a.id = r.activity_id
     WHERE r.reporter_email LIKE '%@review.gachihaeu.com'
        OR a.creator_email LIKE '%@review.gachihaeu.com'
   ))
   OR (report_type = 'comment' AND report_id IN (
     SELECT cr.id FROM comment_reports cr
     LEFT JOIN activity_comments c ON c.id = cr.comment_id
     LEFT JOIN activities a ON a.id = c.activity_id
     WHERE cr.reporter_email LIKE '%@review.gachihaeu.com'
        OR c.author_email LIKE '%@review.gachihaeu.com'
        OR a.creator_email LIKE '%@review.gachihaeu.com'
   ))
   OR (report_type = 'user' AND report_id IN (
     SELECT id FROM user_reports
     WHERE reporter_email LIKE '%@review.gachihaeu.com'
        OR reported_email LIKE '%@review.gachihaeu.com'
   ))
   OR (report_type = 'rating' AND report_id IN (
     SELECT id FROM ratings
     WHERE rater_email LIKE '%@review.gachihaeu.com'
        OR rated_email LIKE '%@review.gachihaeu.com'
   ));
--> statement-breakpoint
DELETE FROM `attendance_codes`
WHERE generated_by LIKE '%@review.gachihaeu.com'
   OR activity_id IN (
     SELECT id FROM activities WHERE creator_email LIKE '%@review.gachihaeu.com'
   );
--> statement-breakpoint
DELETE FROM `notifications`
WHERE user_email LIKE '%@review.gachihaeu.com'
   OR activity_id IN (
     SELECT id FROM activities WHERE creator_email LIKE '%@review.gachihaeu.com'
   );
--> statement-breakpoint
DELETE FROM `reports`
WHERE reporter_email LIKE '%@review.gachihaeu.com'
   OR activity_id IN (
     SELECT id FROM activities WHERE creator_email LIKE '%@review.gachihaeu.com'
   );
--> statement-breakpoint
DELETE FROM `comment_reports`
WHERE reporter_email LIKE '%@review.gachihaeu.com'
   OR comment_id IN (
     SELECT c.id FROM activity_comments c
     LEFT JOIN activities a ON a.id = c.activity_id
     WHERE c.author_email LIKE '%@review.gachihaeu.com'
        OR a.creator_email LIKE '%@review.gachihaeu.com'
   );
--> statement-breakpoint
DELETE FROM `activity_comments`
WHERE author_email LIKE '%@review.gachihaeu.com'
   OR activity_id IN (
     SELECT id FROM activities WHERE creator_email LIKE '%@review.gachihaeu.com'
   );
--> statement-breakpoint
DELETE FROM `ratings`
WHERE rater_email LIKE '%@review.gachihaeu.com'
   OR rated_email LIKE '%@review.gachihaeu.com'
   OR activity_id IN (
     SELECT id FROM activities WHERE creator_email LIKE '%@review.gachihaeu.com'
   );
--> statement-breakpoint
DELETE FROM `participants`
WHERE user_email LIKE '%@review.gachihaeu.com'
   OR activity_id IN (
     SELECT id FROM activities WHERE creator_email LIKE '%@review.gachihaeu.com'
   );
--> statement-breakpoint
DELETE FROM `waitlist`
WHERE user_email LIKE '%@review.gachihaeu.com'
   OR activity_id IN (
     SELECT id FROM activities WHERE creator_email LIKE '%@review.gachihaeu.com'
   );
--> statement-breakpoint
DELETE FROM `user_reports`
WHERE reporter_email LIKE '%@review.gachihaeu.com'
   OR reported_email LIKE '%@review.gachihaeu.com';
--> statement-breakpoint
DELETE FROM `user_blocks`
WHERE blocker_email LIKE '%@review.gachihaeu.com'
   OR blocked_email LIKE '%@review.gachihaeu.com';
--> statement-breakpoint
DELETE FROM `push_tokens` WHERE user_email LIKE '%@review.gachihaeu.com';
--> statement-breakpoint
DELETE FROM `user_sanctions` WHERE user_email LIKE '%@review.gachihaeu.com';
--> statement-breakpoint
DELETE FROM `auth_codes` WHERE email LIKE '%@review.gachihaeu.com';
--> statement-breakpoint
DELETE FROM `role_verification_requests` WHERE user_email LIKE '%@review.gachihaeu.com';
--> statement-breakpoint
DELETE FROM `activities` WHERE creator_email LIKE '%@review.gachihaeu.com';
--> statement-breakpoint
DELETE FROM `user_profiles` WHERE email LIKE '%@review.gachihaeu.com';
--> statement-breakpoint
DELETE FROM `security_rate_limits` WHERE action = 'app-review-login';
--> statement-breakpoint
PRAGMA optimize;
