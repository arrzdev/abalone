CREATE TABLE `game_moves` (
	`game_id` text NOT NULL,
	`move_index` integer NOT NULL,
	`marbles` text,
	`destination` text,
	`is_push` integer,
	`is_capture` integer,
	`shoved_marbles` text,
	`direction` text,
	`black_cells` text NOT NULL,
	`white_cells` text NOT NULL,
	`black_score` integer NOT NULL,
	`white_score` integer NOT NULL,
	`current_turn` text NOT NULL,
	`signature` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`game_id`, `move_index`),
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `game_moves_signature_idx` ON `game_moves` (`game_id`,`signature`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`invite_id` text NOT NULL,
	`black_user_id` text NOT NULL,
	`white_user_id` text NOT NULL,
	`setup_type` text NOT NULL,
	`status` text NOT NULL,
	`black_cells` text NOT NULL,
	`white_cells` text NOT NULL,
	`black_score` integer NOT NULL,
	`white_score` integer NOT NULL,
	`current_turn` text NOT NULL,
	`move_count` integer NOT NULL,
	`winner` text,
	`finish_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`black_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`white_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `games_invite_id_unique` ON `games` (`invite_id`);--> statement-breakpoint
CREATE INDEX `games_black_idx` ON `games` (`black_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `games_white_idx` ON `games` (`white_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`setup_type` text NOT NULL,
	`side` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`from_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_pair_idx` ON `invites` (`from_user_id`,`to_user_id`);--> statement-breakpoint
CREATE INDEX `invites_to_idx` ON `invites` (`to_user_id`,`status`);