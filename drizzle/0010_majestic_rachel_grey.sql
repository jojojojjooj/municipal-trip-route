ALTER TABLE `tripStops` ADD `issueOwner` varchar(100);--> statement-breakpoint
ALTER TABLE `tripStops` ADD `issueDueAt` date;--> statement-breakpoint
ALTER TABLE `tripStops` ADD `issueResolvedAt` timestamp;