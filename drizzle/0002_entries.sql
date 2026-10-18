CREATE TABLE `entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`activity_id` text,
	`location_id` text,
	`start_at` integer NOT NULL,
	`start_zone` text NOT NULL,
	`end_at` integer,
	`end_zone` text,
	`reference` text,
	`description` text,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `entry_user_id_start_at_idx` ON `entry` (`user_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `entry_user_id_end_at_idx` ON `entry` (`user_id`,`end_at`);--> statement-breakpoint
CREATE INDEX `entry_project_id_idx` ON `entry` (`project_id`);