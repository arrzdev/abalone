CREATE TABLE `game_events` (
	`id` text PRIMARY KEY NOT NULL,
	`game_ref` text NOT NULL,
	`kind` text NOT NULL,
	`mode` text NOT NULL,
	`bot_level` integer,
	`result` text,
	`move_count` integer,
	`app_version` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `game_events_created_at_idx` ON `game_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `game_events_game_ref_idx` ON `game_events` (`game_ref`);