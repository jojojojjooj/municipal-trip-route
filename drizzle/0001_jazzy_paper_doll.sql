CREATE TABLE `tripStops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`name` varchar(150) NOT NULL,
	`address` varchar(255) NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`sequence` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tripStops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(150) NOT NULL,
	`tripDate` date NOT NULL,
	`managerName` varchar(100) NOT NULL,
	`shareToken` varchar(36) NOT NULL,
	`routeDistanceKm` decimal(10,2) NOT NULL,
	`routeDurationMinutes` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trips_id` PRIMARY KEY(`id`),
	CONSTRAINT `trips_shareToken_unique` UNIQUE(`shareToken`)
);
--> statement-breakpoint
ALTER TABLE `tripStops` ADD CONSTRAINT `tripStops_tripId_trips_id_fk` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `trips` ADD CONSTRAINT `trips_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;