CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`archived_at` integer,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_user_id_idx` ON `activity` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `activity_user_id_name_key_unq` ON `activity` (`user_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `batch` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`actor` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `batch_user_id_created_at_idx` ON `batch` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `change` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`seq` integer NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`op` text NOT NULL,
	`before` text,
	`after` text,
	`shape` integer NOT NULL,
	`reverts` text,
	FOREIGN KEY (`batch_id`) REFERENCES `batch`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reverts`) REFERENCES `change`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `change_batch_id_seq_idx` ON `change` (`batch_id`,`seq`);--> statement-breakpoint
CREATE INDEX `change_entity_entity_id_idx` ON `change` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `change_reverts_idx` ON `change` (`reverts`);--> statement-breakpoint
CREATE TABLE `customer` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`archived_at` integer,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `customer_user_id_idx` ON `customer` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_user_id_name_key_unq` ON `customer` (`user_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `location` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`archived_at` integer,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `location_user_id_idx` ON `location` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `location_user_id_name_key_unq` ON `location` (`user_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`archived_at` integer,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`customer_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `project_user_id_idx` ON `project` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_customer_id_name_key_unq` ON `project` (`customer_id`,`name_key`);