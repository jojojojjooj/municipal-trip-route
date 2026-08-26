CREATE TABLE `tripAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(80) NOT NULL,
	`entityType` varchar(40) NOT NULL,
	`entityId` int,
	`beforeSnapshot` mediumtext,
	`afterSnapshot` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tripAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tripAuditLogs` ADD CONSTRAINT `tripAuditLogs_tripId_trips_id_fk` FOREIGN KEY (`tripId`) REFERENCES `trips`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tripAuditLogs` ADD CONSTRAINT `tripAuditLogs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;