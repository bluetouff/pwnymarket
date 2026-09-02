import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const votes = sqliteTable(
  'votes',
  {
    id: text('id').primaryKey().notNull(),
    marketId: text('market_id').notNull(),
    voterKey: text('voter_key').notNull(),
    choice: text('choice', { enum: ['yes', 'no'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    uniqueIndex('idx_votes_market_voter').on(table.marketId, table.voterKey),
    index('idx_votes_market_id').on(table.marketId),
    check('votes_choice_check', sql`${table.choice} in ('yes', 'no')`),
  ],
);
