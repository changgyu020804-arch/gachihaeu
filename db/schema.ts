import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    creatorEmail: text("creator_email").notNull(),
    creatorName: text("creator_name").notNull(),
    sport: text("sport").notNull(),
    title: text("title").notNull(),
    venue: text("venue").notNull(),
    startsAt: text("starts_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    capacity: integer("capacity").notNull(),
    level: text("level").notNull(),
    description: text("description").notNull().default(""),
    notice: text("notice").notNull().default(""),
    noticeUpdatedAt: text("notice_updated_at"),
    status: text("status").notNull().default("open"),
    facilityReserved: integer("facility_reserved").notNull().default(0),
    cancellationDeadlineMinutes: integer("cancellation_deadline_minutes").notNull().default(60),
    cancellationReason: text("cancellation_reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("activities_starts_at_idx").on(table.startsAt),
    index("activities_creator_idx").on(table.creatorEmail),
    index("activities_status_idx").on(table.status),
  ],
);

export const participants = sqliteTable(
  "participants",
  {
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
    displayName: text("display_name").notNull(),
    attendanceStatus: text("attendance_status").notNull().default("pending"),
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.activityId, table.userEmail] }),
    index("participants_user_idx").on(table.userEmail),
    index("participants_attendance_idx").on(table.activityId, table.attendanceStatus),
  ],
);

export const userProfiles = sqliteTable(
  "user_profiles",
  {
    email: text("email").primaryKey(),
    nickname: text("nickname").notNull().default(""),
    nicknameNormalized: text("nickname_normalized"),
    gender: text("gender").notNull().default(""),
    campusRole: text("campus_role").notNull().default(""),
    requestedCampusRole: text("requested_campus_role").notNull().default(""),
    roleVerificationStatus: text("role_verification_status")
      .notNull()
      .default("not_required"),
    department: text("department").notNull().default(""),
    bio: text("bio").notNull().default(""),
    preferredSports: text("preferred_sports").notNull().default(""),
    onboardingCompleted: integer("onboarding_completed").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("user_profiles_nickname_normalized_idx").on(
      table.nicknameNormalized,
    ),
  ],
);

export const roleVerificationRequests = sqliteTable(
  "role_verification_requests",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    requestedRole: text("requested_role").notNull(),
    documentType: text("document_type").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    objectKey: text("object_key").notNull(),
    status: text("status").notNull().default("pending"),
    reviewerEmail: text("reviewer_email"),
    reviewNote: text("review_note").notNull().default(""),
    reviewedAt: text("reviewed_at"),
    evidenceDeleteAfter: text("evidence_delete_after"),
    evidenceDeletedAt: text("evidence_deleted_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("role_verification_user_created_idx").on(
      table.userEmail,
      table.createdAt,
    ),
    index("role_verification_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const ratings = sqliteTable(
  "ratings",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    raterEmail: text("rater_email").notNull(),
    ratedEmail: text("rated_email").notNull(),
    trustScore: integer("trust_score").notNull(),
    skillScore: integer("skill_score").notNull(),
    mannerScore: integer("manner_score").notNull(),
    ratingType: text("rating_type").notNull().default("legacy"),
    comment: text("comment").notNull().default(""),
    commentHidden: integer("comment_hidden").notNull().default(0),
    reportedAt: text("reported_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("ratings_unique_idx").on(table.activityId, table.raterEmail, table.ratedEmail),
    index("ratings_rated_idx").on(table.ratedEmail),
    index("ratings_activity_idx").on(table.activityId),
    index("ratings_type_idx").on(table.ratedEmail, table.ratingType),
  ],
);

export const authCodes = sqliteTable("auth_codes", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const securityRateLimits = sqliteTable(
  "security_rate_limits",
  {
    action: text("action").notNull(),
    keyHash: text("key_hash").notNull(),
    windowBucket: integer("window_bucket").notNull(),
    requestCount: integer("request_count").notNull().default(1),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({
      columns: [table.action, table.keyHash, table.windowBucket],
    }),
    index("security_rate_limits_updated_idx").on(table.updatedAt),
  ],
);

export const securityAuditLogs = sqliteTable(
  "security_audit_logs",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    subjectHash: text("subject_hash").notNull(),
    ipHash: text("ip_hash").notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("security_audit_logs_created_idx").on(table.createdAt),
    index("security_audit_logs_event_idx").on(table.eventType, table.createdAt),
  ],
);

export const waitlist = sqliteTable(
  "waitlist",
  {
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userEmail: text("user_email").notNull(),
    displayName: text("display_name").notNull(),
    position: integer("position").notNull(),
    status: text("status").notNull().default("waiting"),
    queuedAt: text("queued_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.activityId, table.userEmail] }),
    index("waitlist_activity_position_idx").on(table.activityId, table.position),
  ],
);

export const reports = sqliteTable(
  "reports",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    reporterEmail: text("reporter_email").notNull(),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("reports_activity_reporter_idx").on(table.activityId, table.reporterEmail),
  ],
);

export const activityComments = sqliteTable(
  "activity_comments",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    authorEmail: text("author_email").notNull(),
    content: text("content").notNull(),
    status: text("status").notNull().default("visible"),
    isPinned: integer("is_pinned").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("activity_comments_activity_created_idx").on(
      table.activityId,
      table.createdAt,
    ),
    index("activity_comments_author_idx").on(table.authorEmail),
  ],
);

export const commentReports = sqliteTable(
  "comment_reports",
  {
    id: text("id").primaryKey(),
    commentId: text("comment_id")
      .notNull()
      .references(() => activityComments.id, { onDelete: "cascade" }),
    reporterEmail: text("reporter_email").notNull(),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("comment_reports_comment_reporter_idx").on(
      table.commentId,
      table.reporterEmail,
    ),
    index("comment_reports_comment_idx").on(table.commentId),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    activityId: text("activity_id"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("notifications_user_dedupe_idx").on(table.userEmail, table.dedupeKey),
    index("notifications_user_created_idx").on(table.userEmail, table.createdAt),
    index("notifications_user_read_idx").on(table.userEmail, table.readAt),
  ],
);

export const userReports = sqliteTable(
  "user_reports",
  {
    id: text("id").primaryKey(),
    reporterEmail: text("reporter_email").notNull(),
    reportedEmail: text("reported_email").notNull(),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("user_reports_pair_idx").on(table.reporterEmail, table.reportedEmail),
    index("user_reports_reported_idx").on(table.reportedEmail),
  ],
);

export const userBlocks = sqliteTable(
  "user_blocks",
  {
    blockerEmail: text("blocker_email").notNull(),
    blockedEmail: text("blocked_email").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.blockerEmail, table.blockedEmail] }),
    index("user_blocks_blocked_idx").on(table.blockedEmail),
  ],
);

export const attendanceCodes = sqliteTable(
  "attendance_codes",
  {
    activityId: text("activity_id")
      .primaryKey()
      .references(() => activities.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    validFrom: text("valid_from").notNull(),
    expiresAt: text("expires_at").notNull(),
    generatedBy: text("generated_by").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("attendance_codes_expiry_idx").on(table.expiresAt)],
);

export const moderationActions = sqliteTable(
  "moderation_actions",
  {
    id: text("id").primaryKey(),
    reportType: text("report_type").notNull(),
    reportId: text("report_id").notNull(),
    action: text("action").notNull(),
    targetEmail: text("target_email").notNull(),
    moderatorEmail: text("moderator_email").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("moderation_actions_report_idx").on(table.reportType, table.reportId),
    index("moderation_actions_target_idx").on(table.targetEmail, table.createdAt),
  ],
);

export const userSanctions = sqliteTable(
  "user_sanctions",
  {
    id: text("id").primaryKey(),
    userEmail: text("user_email").notNull(),
    kind: text("kind").notNull(),
    reason: text("reason").notNull(),
    expiresAt: text("expires_at"),
    createdBy: text("created_by").notNull(),
    revokedAt: text("revoked_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("user_sanctions_active_idx").on(
      table.userEmail,
      table.revokedAt,
      table.expiresAt,
    ),
  ],
);
