CREATE TABLE `auth_lockouts` (
	`identifier` text PRIMARY KEY NOT NULL,
	`failed_count` integer NOT NULL,
	`last_failed_at` integer NOT NULL,
	`locked_until` integer
);
