CREATE TABLE `user_devices` (
	`device_id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`label` text NOT NULL,
	`user_agent` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE TABLE `vip_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_email` text NOT NULL,
	`days` integer NOT NULL,
	`source` text DEFAULT 'admin' NOT NULL,
	`granted_by` text,
	`granted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text
);
--> statement-breakpoint
ALTER TABLE `users` ADD `contact_email` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatar_key` text;--> statement-breakpoint
ALTER TABLE `users` ADD `cover_key` text;