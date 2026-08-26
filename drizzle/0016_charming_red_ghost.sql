CREATE TABLE `tripExpenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`category` enum('transport','parking','meal','lodging','other') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`note` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tripExpenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tripExpenses` ADD CONSTRAINT `tripExpenses_tripId_trips_id_fk` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE cascade ON UPDATE no action;