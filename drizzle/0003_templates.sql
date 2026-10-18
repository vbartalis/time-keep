CREATE TABLE `template` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`customer_id` text,
	`project_id` text,
	`activity_id` text,
	`location_id` text,
	`start_time` text,
	`end_time` text,
	`duration_minutes` integer,
	`time_zone` text,
	`reference` text,
	`description` text,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `template_user_id_idx` ON `template` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `template_user_id_name_key_unq` ON `template` (`user_id`,`name_key`);