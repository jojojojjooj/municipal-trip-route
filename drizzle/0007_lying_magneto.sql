CREATE TABLE `tripDrafts` (
	`ownerId` int NOT NULL,
	`payload` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tripDrafts_ownerId` PRIMARY KEY(`ownerId`)
);
--> statement-breakpoint
ALTER TABLE `tripDrafts` ADD CONSTRAINT `tripDrafts_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;