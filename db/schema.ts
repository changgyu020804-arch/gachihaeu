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
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.activityId, table.userEmail] }),
    index("participants_user_idx").on(table.userEmail),
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
