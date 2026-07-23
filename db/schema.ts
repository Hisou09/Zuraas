import { sql } from "drizzle-orm";
import { integer, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("member"),
  usercode: text("usercode").notNull().unique(),
  vipUntil: timestamp("vip_until", { mode: "string", withTimezone: true }),
  contactEmail: text("contact_email"),
  avatarKey: text("avatar_key"),
  coverKey: text("cover_key"),
  passwordHash: text("password_hash"),
  createdAt: createdAt(),
});

export const authSessions = pgTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userEmail: text("user_email").notNull(),
  expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }).notNull(),
  userAgent: text("user_agent").notNull().default(""),
  createdAt: createdAt(),
});

export const userDevices = pgTable("user_devices", {
  deviceId: text("device_id").primaryKey(), userEmail: text("user_email").notNull(),
  label: text("label").notNull(), userAgent: text("user_agent").notNull().default(""),
  lastIp: text("last_ip").notNull().default(""),
  createdAt: createdAt(), lastSeenAt: timestamp("last_seen_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  revokedAt: timestamp("revoked_at", { mode: "string", withTimezone: true }),
});

export const vipHistory = pgTable("vip_history", {
  id: serial("id").primaryKey(), userEmail: text("user_email").notNull(), days: integer("days").notNull(),
  source: text("source").notNull().default("admin"), grantedBy: text("granted_by"),
  grantedAt: timestamp("granted_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
  expiresAt: timestamp("expires_at", { mode: "string", withTimezone: true }),
});

export const contents = pgTable("contents", {
  id: text("id").primaryKey(), title: text("title").notNull(), originalTitle: text("original_title").notNull(),
  type: text("type").notNull(), status: text("status").notNull(), year: integer("year").notNull(),
  episodeCount: integer("episode_count").notNull().default(0), rating: real("rating").notNull().default(0),
  genres: text("genres").notNull().default(""), image: text("image").notNull(), bannerImage: text("banner_image").notNull().default(""),
  characters: text("characters").notNull().default("[]"), description: text("description").notNull().default(""),
  adult: integer("adult").notNull().default(0), anilistId: integer("anilist_id"), createdAt: createdAt(),
});

export const libraryItems = pgTable("library_items", {
  id: serial("id").primaryKey(), userEmail: text("user_email").notNull(), contentId: text("content_id").notNull(), createdAt: createdAt(),
}, table => [uniqueIndex("library_user_content_idx").on(table.userEmail, table.contentId)]);

export const watchHistory = pgTable("watch_history", {
  id: serial("id").primaryKey(), userEmail: text("user_email").notNull(), contentId: text("content_id").notNull(),
  progress: integer("progress").notNull().default(1), pageIndex: integer("page_index").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("history_user_content_idx").on(table.userEmail, table.contentId)]);

export const entryReads = pgTable("entry_reads", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  contentId: text("content_id").notNull(),
  entryNumber: real("entry_number").notNull(),
  readAt: timestamp("read_at", { mode: "string", withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => [uniqueIndex("entry_reads_user_content_number_idx").on(table.userEmail, table.contentId, table.entryNumber)]);

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(), contentId: text("content_id").notNull(), userEmail: text("user_email").notNull(),
  displayName: text("display_name").notNull(), body: text("body").notNull(), createdAt: createdAt(),
});

export const errorReports = pgTable("error_reports", {
  id: serial("id").primaryKey(), contentId: text("content_id").notNull(), chapterNumber: real("chapter_number").notNull(),
  userEmail: text("user_email").notNull(), issueType: text("issue_type").notNull(), details: text("details").notNull().default(""),
  status: text("status").notNull().default("open"), createdAt: createdAt(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(), userEmail: text("user_email").notNull(), title: text("title").notNull(), body: text("body").notNull(),
  link: text("link"), isRead: integer("is_read").notNull().default(0), createdAt: createdAt(),
});

export const vipSettings = pgTable("vip_settings", {
  id: integer("id").primaryKey(), bankName: text("bank_name").notNull(), accountNumber: text("account_number").notNull(),
  accountHolder: text("account_holder").notNull(), promotion: text("promotion").notNull().default(""),
  globalDiscount: integer("global_discount").notNull().default(0), accentColor: text("accent_color").notNull().default("#8b6cf6"),
});

export const episodes = pgTable("episodes", {
  id: serial("id").primaryKey(), contentId: text("content_id").notNull(), number: real("number").notNull(),
  access: text("access").notNull().default("registered"), publishAt: timestamp("publish_at", { mode: "string", withTimezone: true }),
  mediaKeys: text("media_keys").notNull().default("[]"), createdAt: createdAt(),
});

export const socialSettings = pgTable("social_settings", {
  id: integer("id").primaryKey(), facebook: text("facebook").notNull().default(""), instagram: text("instagram").notNull().default(""),
  youtube: text("youtube").notNull().default(""), discord: text("discord").notNull().default(""), telegram: text("telegram").notNull().default(""),
});

export const vipPackages = pgTable("vip_packages", {
  id: serial("id").primaryKey(), name: text("name").notNull(), durationDays: integer("duration_days").notNull(),
  price: integer("price").notNull(), discountPercent: integer("discount_percent").notNull().default(0), active: integer("active").notNull().default(1),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: serial("id").primaryKey(), eventType: text("event_type").notNull(), userEmail: text("user_email"),
  amount: integer("amount").notNull().default(0), createdAt: createdAt(),
});
