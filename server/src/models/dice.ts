// =============================================================================
// Horizon — Dice Model
// =============================================================================
// Database query functions for the dice_logs table. All dice roll persistence
// flows through these functions — never write raw SQL in routes or services.
// =============================================================================

import db from './db.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Raw dice_logs row as returned from the database. */
export interface DiceLogRow {
  id: string;
  campaign_id: string;
  character_id: string | null;
  roller_user_id: string;
  pool_json: string;
  modifiers_json: string | null;
  roll_source: string;
  result_json: string;
  reason: string | null;
  created_at: string;
}

/** DiceLogRow enriched with the roller's display_name via JOIN. */
export interface DiceLogRowWithDisplayName extends DiceLogRow {
  roller_display_name: string | null;
}

/** Parameters for inserting a new dice log entry. */
export interface InsertDiceLogParams {
  id: string;
  campaignId: string;
  characterId?: string | null;
  rollerUserId: string;
  poolJson: string;
  modifiersJson?: string | null;
  rollSource: string;
  resultJson: string;
  reason?: string | null;
}

/** Options for paginated dice log queries. */
export interface DiceLogQueryOptions {
  limit?: number;
  offset?: number;
}

// -----------------------------------------------------------------------------
// Prepared Statements
// -----------------------------------------------------------------------------

const stmtInsert = db.prepare(`
  INSERT INTO dice_logs (id, campaign_id, character_id, roller_user_id, pool_json, modifiers_json, roll_source, result_json, reason, created_at)
  VALUES (@id, @campaignId, @characterId, @rollerUserId, @poolJson, @modifiersJson, @rollSource, @resultJson, @reason, datetime('now'))
`);

const stmtFindByCampaign = db.prepare(`
  SELECT
    dl.id,
    dl.campaign_id,
    dl.character_id,
    dl.roller_user_id,
    dl.pool_json,
    dl.modifiers_json,
    dl.roll_source,
    dl.result_json,
    dl.reason,
    dl.created_at,
    u.display_name AS roller_display_name
  FROM dice_logs dl
  LEFT JOIN users u ON u.id = dl.roller_user_id
  WHERE dl.campaign_id = ?
  ORDER BY dl.created_at DESC
  LIMIT ? OFFSET ?
`);

const stmtCountByCampaign = db.prepare(`
  SELECT COUNT(*) AS total FROM dice_logs WHERE campaign_id = ?
`);

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

/**
 * Insert a completed dice roll into the dice_logs table.
 */
export function insertDiceLog(params: InsertDiceLogParams): void {
  stmtInsert.run(params);
}

/**
 * Retrieve paginated dice log entries for a campaign, newest first.
 * Returns entries enriched with the roller's display name.
 */
export function getDiceLog(
  campaignId: string,
  options: DiceLogQueryOptions = {},
): { entries: DiceLogRow[]; total: number } {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const entries = stmtFindByCampaign.all(campaignId, limit, offset) as DiceLogRow[];
  const { total } = stmtCountByCampaign.get(campaignId) as { total: number };

  return { entries, total };
}
