CREATE TABLE `tripStopPhotos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripStopId` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`url` varchar(750) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tripStopPhotos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tripStopPhotos` ADD CONSTRAINT `tripStopPhotos_tripStopId_tripStops_id_fk` FOREIGN KEY (`tripStopId`) REFERENCES `tripStops`(`id`) ON DELETE cascade ON UPDATE no action;