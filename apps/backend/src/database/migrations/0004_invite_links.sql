CREATE TABLE `invite_links` (
	`id` text PRIMARY KEY NOT NULL,
	`from_user_id` text NOT NULL,
	`setup_type` text NOT NULL,
	`side` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`used_by_user_id` text,
	`game_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`from_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `invite_links_from_idx` ON `invite_links` (`from_user_id`);