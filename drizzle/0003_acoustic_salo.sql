CREATE TABLE `error_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_id` text NOT NULL,
	`chapter_number` real NOT NULL,
	`user_email` text NOT NULL,
	`issue_type` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
