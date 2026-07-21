CREATE TABLE `episodes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_id` text NOT NULL,
	`number` real NOT NULL,
	`access` text DEFAULT 'registered' NOT NULL,
	`publish_at` text,
	`media_keys` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`facebook` text DEFAULT '' NOT NULL,
	`instagram` text DEFAULT '' NOT NULL,
	`youtube` text DEFAULT '' NOT NULL,
	`discord` text DEFAULT '' NOT NULL,
	`telegram` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_analytics_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_type` text NOT NULL,
	`user_email` text,
	`amount` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_analytics_events`("id", "event_type", "user_email", "amount", "created_at") SELECT "id", "event_type", "user_email", "amount", "created_at" FROM `analytics_events`;--> statement-breakpoint
DROP TABLE `analytics_events`;--> statement-breakpoint
ALTER TABLE `__new_analytics_events` RENAME TO `analytics_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_id` text NOT NULL,
	`user_email` text NOT NULL,
	`display_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_comments`("id", "content_id", "user_email", "display_name", "body", "created_at") SELECT "id", "content_id", "user_email", "display_name", "body", "created_at" FROM `comments`;--> statement-breakpoint
DROP TABLE `comments`;--> statement-breakpoint
ALTER TABLE `__new_comments` RENAME TO `comments`;--> statement-breakpoint
CREATE TABLE `__new_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`original_title` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`year` integer NOT NULL,
	`episode_count` integer DEFAULT 0 NOT NULL,
	`rating` real DEFAULT 0 NOT NULL,
	`genres` text DEFAULT '' NOT NULL,
	`image` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`adult` integer DEFAULT false NOT NULL,
	`anilist_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_contents`("id", "title", "original_title", "type", "status", "year", "episode_count", "rating", "genres", "image", "description", "adult", "anilist_id", "created_at") SELECT "id", "title", "original_title", "type", "status", "year", "episode_count", "rating", "genres", "image", '', false, NULL, "created_at" FROM `contents`;--> statement-breakpoint
DROP TABLE `contents`;--> statement-breakpoint
ALTER TABLE `__new_contents` RENAME TO `contents`;--> statement-breakpoint
CREATE TABLE `__new_library_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`content_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_library_items`("id", "user_email", "content_id", "created_at") SELECT "id", "user_email", "content_id", "created_at" FROM `library_items`;--> statement-breakpoint
DROP TABLE `library_items`;--> statement-breakpoint
ALTER TABLE `__new_library_items` RENAME TO `library_items`;--> statement-breakpoint
CREATE UNIQUE INDEX `library_user_content_idx` ON `library_items` (`user_email`,`content_id`);--> statement-breakpoint
CREATE TABLE `__new_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`is_read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_notifications`("id", "user_email", "title", "body", "is_read", "created_at") SELECT "id", "user_email", "title", "body", "is_read", "created_at" FROM `notifications`;--> statement-breakpoint
DROP TABLE `notifications`;--> statement-breakpoint
ALTER TABLE `__new_notifications` RENAME TO `notifications`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`usercode` text NOT NULL,
	`vip_until` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "display_name", "role", "usercode", "vip_until", "created_at") SELECT "id", "email", "display_name", "role", printf('%06d', (("id" * 7919) % 900000) + 100000), NULL, "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_usercode_unique` ON `users` (`usercode`);--> statement-breakpoint
CREATE TABLE `__new_watch_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`content_id` text NOT NULL,
	`progress` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_watch_history`("id", "user_email", "content_id", "progress", "updated_at") SELECT "id", "user_email", "content_id", "progress", "updated_at" FROM `watch_history`;--> statement-breakpoint
DROP TABLE `watch_history`;--> statement-breakpoint
ALTER TABLE `__new_watch_history` RENAME TO `watch_history`;--> statement-breakpoint
CREATE UNIQUE INDEX `history_user_content_idx` ON `watch_history` (`user_email`,`content_id`);--> statement-breakpoint
ALTER TABLE `vip_settings` ADD `global_discount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `vip_settings` DROP COLUMN `headline`;
