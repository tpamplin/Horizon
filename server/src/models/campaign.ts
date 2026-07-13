// =============================================================================
// Horizon — Campaign Model
// =============================================================================
// Database query functions for the campaigns and campaign_players tables.
// All campaign DB access flows through this module — never write raw SQL
// in routes or services.
// =============================================================================

import db from './db.js';
import { findCampaignCharacters } from './character.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Raw campaign row as returned from the database (snake_case columns). */
export interface CampaignRow {
  id: string;
  name: string;
  description: string;
  gm_user_id: string;
  active_background_url: string | null;
  invite_code: string;
  ruleset_version: string;
  created_at: string;
  /** Number of players in the campaign (populated by findByUserId query). */
  player_count?: number;
}

/** Raw campaign_players row as returned from the database. */
export interface CampaignPlayerRow {
  campaign_id: string;
  user_id: string;
  role: 'gm' | 'player';
}

/** Parameters for creating a new campaign. */
export interface CreateCampaignParams {
  id: string;
  name: string;
  description: string;
  gmUserId: string;
  inviteCode: string;
}

// -----------------------------------------------------------------------------
// Prepared Statements (created once, reused)
// -----------------------------------------------------------------------------

const stmtCreateCampaign = db.prepare(`
  INSERT INTO campaigns (id, name, description, gm_user_id, active_background_url, invite_code, ruleset_version, created_at)
  VALUES (@id, @name, @description, @gmUserId, NULL, @inviteCode, 'horizon-v1', datetime('now'))
`);

const stmtCreateCampaignPlayer = db.prepare(`
  INSERT INTO campaign_players (campaign_id, user_id, role)
  VALUES (@campaignId, @userId, @role)
`);

const stmtFindById = db.prepare(`
  SELECT id, name, description, gm_user_id, active_background_url, invite_code, ruleset_version, created_at
  FROM campaigns WHERE id = ?
`);

const stmtFindByUserId = db.prepare(`
  SELECT c.id, c.name, c.description, c.gm_user_id, c.active_background_url,
         c.invite_code, c.ruleset_version, c.created_at,
         (SELECT COUNT(*) FROM campaign_players WHERE campaign_id = c.id) as player_count
  FROM campaigns c
  INNER JOIN campaign_players cp ON cp.campaign_id = c.id
  WHERE cp.user_id = ?
  ORDER BY c.created_at DESC
`);

const stmtFindMembership = db.prepare(`
  SELECT campaign_id, user_id, role
  FROM campaign_players
  WHERE campaign_id = ? AND user_id = ?
`);

const stmtFindByInviteCode = db.prepare(`
  SELECT id, name, description, gm_user_id, active_background_url,
         invite_code, ruleset_version, created_at
  FROM campaigns
  WHERE invite_code = ?
`);

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

/**
 * Create a new campaign and assign the creator as GM in a single transaction.
 * Both operations succeed or fail together — no orphaned campaigns or memberships.
 *
 * Returns the raw database row of the newly created campaign.
 */
export function createCampaign(params: CreateCampaignParams): CampaignRow {
  const createTransaction = db.transaction(() => {
    stmtCreateCampaign.run({
      id: params.id,
      name: params.name,
      description: params.description,
      gmUserId: params.gmUserId,
      inviteCode: params.inviteCode,
    });

    stmtCreateCampaignPlayer.run({
      campaignId: params.id,
      userId: params.gmUserId,
      role: 'gm',
    });

    const row = stmtFindById.get(params.id) as CampaignRow | undefined;
    return row!;
  });

  return createTransaction();
}

/**
 * Find a campaign by its unique ID.
 * Returns the raw database row or null if no campaign exists with that ID.
 */
export function findById(campaignId: string): CampaignRow | null {
  const row = stmtFindById.get(campaignId) as CampaignRow | undefined;
  return row ?? null;
}

/**
 * Find all campaigns a user belongs to (as GM or player),
 * ordered by most recently created first.
 * Returns an array of raw database rows (empty array if none).
 */
export function findByUserId(userId: string): CampaignRow[] {
  return stmtFindByUserId.all(userId) as CampaignRow[];
}

/**
 * Find a user's membership record for a specific campaign.
 * Returns the raw row or null if the user is not a member.
 */
export function findMembership(campaignId: string, userId: string): CampaignPlayerRow | null {
  const row = stmtFindMembership.get(campaignId, userId) as CampaignPlayerRow | undefined;
  return row ?? null;
}

/**
 * Check whether an invite code is already in use.
 * Returns the campaign row that owns the code, or null if the code is available.
 */
export function findByInviteCode(inviteCode: string): CampaignRow | null {
  const row = stmtFindByInviteCode.get(inviteCode) as CampaignRow | undefined;
  return row ?? null;
}

// -----------------------------------------------------------------------------
// Detail Enrichment Queries
// -----------------------------------------------------------------------------

/**
 * Row shape for a player detail lookup (joins campaign_players with users).
 */
export interface PlayerDetailRow {
  userId: string;
  displayName: string;
  role: CampaignPlayerRow['role'];
}

/**
 * Find all players in a campaign with their display names.
 * Joins campaign_players with users to return human-readable player info.
 */
export function findPlayersByCampaign(campaignId: string): PlayerDetailRow[] {
  const stmt = db.prepare(`
    SELECT u.id as userId, u.display_name as displayName, cp.role
    FROM campaign_players cp
    INNER JOIN users u ON u.id = cp.user_id
    WHERE cp.campaign_id = ?
    ORDER BY cp.role, u.display_name
  `);
  return stmt.all(campaignId) as PlayerDetailRow[];
}

/**
 * Row shape for a character brief lookup.
 */
export interface CharacterBriefRow {
  id: string;
  name: string;
  archetype: string;
}

/**
 * Find all characters in a campaign (brief — id, name, archetype only).
 * Delegates to the character model's campaign roster query.
 */
export function findCharactersByCampaign(campaignId: string): CharacterBriefRow[] {
  const rows = findCampaignCharacters(campaignId);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    archetype: r.archetype,
  }));
}

// -----------------------------------------------------------------------------
// Membership Mutations (join / leave)
// -----------------------------------------------------------------------------

/**
 * Add a player to a campaign with the given role.
 * Uses INSERT OR IGNORE to safely handle cases where the user is already a member
 * (avoids duplicate key errors; callers should check membership first).
 */
export function addPlayer(
  campaignId: string,
  userId: string,
  role: CampaignPlayerRow['role'],
): void {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO campaign_players (campaign_id, user_id, role)
    VALUES (?, ?, ?)
  `);
  stmt.run(campaignId, userId, role);
}

/**
 * Remove a player from a campaign.
 */
export function removePlayer(campaignId: string, userId: string): void {
  const stmt = db.prepare(`
    DELETE FROM campaign_players WHERE campaign_id = ? AND user_id = ?
  `);
  stmt.run(campaignId, userId);
}
