import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("member"),
  usercode: text("usercode").notNull().unique(),
  vipUntil: text("vip_until"),
  contactEmail: text("contact_email"),
  avatarKey: text("avatar_key"),
  coverKey: text("cover_key"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const userDevices = sqliteTable("user_devices", {
  deviceId: text("device_id").primaryKey(),
  userEmail: text("user_email").notNull(),
  label: text("label").notNull(),
  userAgent: text("user_agent").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  revokedAt: text("revoked_at"),
});

export const vipHistory = sqliteTable("vip_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  days: integer("days").notNull(),
  source: text("source").notNull().default("admin"),
  grantedBy: text("granted_by"),
  grantedAt: text("granted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at"),
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
  description: text("description").notNull().default(""),
  adult: integer("adult", { mode: "boolean" }).notNull().default(false),
  anilistId: integer("anilist_id"),
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

export const errorReports = sqliteTable("error_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentId: text("content_id").notNull(),
  chapterNumber: real("chapter_number").notNull(),
  userEmail: text("user_email").notNull(),
  issueType: text("issue_type").notNull(),
  details: text("details").notNull().default(""),
  status: text("status").notNull().default("open"),
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
  promotion: text("promotion").notNull().default(""),
  globalDiscount: integer("global_discount").notNull().default(0),
  accentColor: text("accent_color").notNull().default("#8b6cf6"),
});

export const episodes = sqliteTable("episodes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentId: text("content_id").notNull(),
  number: real("number").notNull(),
  access: text("access").notNull().default("registered"),
  publishAt: text("publish_at"),
  mediaKeys: text("media_keys").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const socialSettings = sqliteTable("social_settings", {
  id: integer("id").primaryKey(),
  facebook: text("facebook").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  youtube: text("youtube").notNull().default(""),
  discord: text("discord").notNull().default(""),
  telegram: text("telegram").notNull().default(""),
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
