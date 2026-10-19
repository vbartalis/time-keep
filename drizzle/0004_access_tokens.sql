CREATE TABLE `access_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_token_token_hash_unique` ON `access_token` (`token_hash`);--> statement-breakpoint
CREATE INDEX `access_token_user_id_idx` ON `access_token` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `access_token_user_id_name_key_unq` ON `access_token` (`user_id`,`name_key`);