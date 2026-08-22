ALTER TABLE `tripStops` ADD `executionStatus` enum('planned','in_progress','completed','issue') DEFAULT 'planned' NOT NULL;--> statement-breakpoint
ALTER TABLE `tripStops` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tripStops` ADD `issueNote` varchar(1000);--> statement-breakpoint
ALTER TABLE `trips` ADD `preDepartureChecked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trips` ADD `onSiteChecked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `trips` ADD `wrapUpChecked` boolean DEFAULT false NOT NULL;