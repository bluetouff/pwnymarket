CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`market_id` text NOT NULL,
	`voter_key` text NOT NULL,
	`choice` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "votes_choice_check" CHECK("votes"."choice" in ('yes', 'no'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_votes_market_voter` ON `votes` (`market_id`,`voter_key`);--> statement-breakpoint
CREATE INDEX `idx_votes_market_id` ON `votes` (`market_id`);--> statement-breakpoint
PRAGMA optimize;
