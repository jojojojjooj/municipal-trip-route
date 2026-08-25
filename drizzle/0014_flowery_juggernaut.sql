ALTER TABLE `tripStops` ADD `serviceMinutes` int DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `tripStops` ADD `windowStart` varchar(5);--> statement-breakpoint
ALTER TABLE `tripStops` ADD `windowEnd` varchar(5);--> statement-breakpoint
ALTER TABLE `trips` ADD `departureTime` varchar(5) DEFAULT '09:00' NOT NULL;