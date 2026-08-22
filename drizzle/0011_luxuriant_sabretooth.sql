CREATE TABLE `tripCollaborators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`userId` int NOT NULL,
	`permission` enum('viewer','editor') NOT NULL DEFAULT 'viewer',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tripCollaborators_id` PRIMARY KEY(`id`),
	CONSTRAINT `tripCollaborators_tripId_userId_unique` UNIQUE(`tripId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `trips` ADD `department` varchar(100);--> statement-breakpoint
ALTER TABLE `tripCollaborators` ADD CONSTRAINT `tripCollaborators_tripId_trips_id_fk` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tripCollaborators` ADD CONSTRAINT `tripCollaborators_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;