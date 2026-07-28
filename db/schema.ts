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
    status: text("status").notNull().default("open"),
    facilityReserved: integer("facility_reserved").notNull().default(0),
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
    department: text("department").notNull().default(""),
    bio: text("bio").notNull().default(""),
    preferredSports: text("preferred_sports").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
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

export const authCodes = sqliteTable(
  "auth_codes",
  {
    email: text("email").notNull(),
    code: text("code").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("auth_codes_email_idx").on(table.email),
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
