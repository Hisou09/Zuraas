import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("member"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const contents = sqliteTable("contents", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  originalTitle: text("original_title").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  year: integer("year").notNull(),
  episodeCount: integer("episode_count").notNull().default(0),
  rating: real("rating").notNull().default(0),
  genres: text("genres").notNull().default(""),
  image: text("image").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const libraryItems = sqliteTable("library_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  contentId: text("content_id").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("library_user_content_idx").on(table.userEmail, table.contentId)]);

export const watchHistory = sqliteTable("watch_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  contentId: text("content_id").notNull(),
  progress: integer("progress").notNull().default(1),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("history_user_content_idx").on(table.userEmail, table.contentId)]);

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentId: text("content_id").notNull(),
  userEmail: text("user_email").notNull(),
  displayName: text("display_name").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const vipSettings = sqliteTable("vip_settings", {
  id: integer("id").primaryKey(),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number").notNull(),
  accountHolder: text("account_holder").notNull(),
  headline: text("headline").notNull(),
  promotion: text("promotion").notNull().default(""),
  accentColor: text("accent_color").notNull().default("#8b6cf6"),
});

export const vipPackages = sqliteTable("vip_packages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  durationDays: integer("duration_days").notNull(),
  price: integer("price").notNull(),
  discountPercent: integer("discount_percent").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const analyticsEvents = sqliteTable("analytics_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventType: text("event_type").notNull(),
  userEmail: text("user_email"),
  amount: integer("amount").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
