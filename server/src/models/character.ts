// =============================================================================
// Horizon — Character Model
// =============================================================================
// Database query functions for the characters table and campaign roster.
// Characters belong to users (player_user_id) — NOT campaigns. Characters
// are added to campaigns via the campaign_characters join table.
// =============================================================================

import db from './db.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Raw character row as returned from the database (snake_case columns). */
export interface CharacterRow {
  id: string;
  player_user_id: string;
  name: string;
  archetype: string;
  portrait_url: string | null;
  /** JSON string — parsed to SheetData by the service layer. */
  sheet_data: string;
  created_at: string;
}

/** Parameters for creating a new character. */
export interface CreateCharacterParams {
  id: string;
  playerUserId: string;
  name: string;
  archetype: string;
  /** Pre-serialized JSON string of the initial sheet data. */
  sheetData: string;
}

// -----------------------------------------------------------------------------
// Prepared Statements — Characters
// -----------------------------------------------------------------------------

const stmtCreateCharacter = db.prepare(`
  INSERT INTO characters (id, player_user_id, name, archetype, portrait_url, sheet_data, created_at)
  VALUES (@id, @playerUserId, @name, @archetype, NULL, @sheetData, datetime('now'))
`);

const stmtFindById = db.prepare(`
  SELECT id, player_user_id, name, archetype, portrait_url, sheet_data, created_at
  FROM characters WHERE id = ?
`);

const stmtFindByUserId = db.prepare(`
  SELECT id, player_user_id, name, archetype, portrait_url, sheet_data, created_at
  FROM characters
  WHERE player_user_id = ?
  ORDER BY name
`);

const stmtUpdateSheet = db.prepare(`
  UPDATE characters
  SET sheet_data = @sheetData,
      name = COALESCE(@name, name),
      archetype = COALESCE(@archetype, archetype)
  WHERE id = @id
`);

const stmtDelete = db.prepare(`
  DELETE FROM characters WHERE id = ?
`);

// -----------------------------------------------------------------------------
// Prepared Statements — Campaign Roster (Join Table)
// -----------------------------------------------------------------------------

const stmtAddToCampaign = db.prepare(`
  INSERT OR IGNORE INTO campaign_characters (campaign_id, character_id, added_by, added_at)
  VALUES (@campaignId, @characterId, @addedBy, datetime('now'))
`);

const stmtRemoveFromCampaign = db.prepare(`
  DELETE FROM campaign_characters
  WHERE campaign_id = @campaignId AND character_id = @characterId
`);

const stmtFindCampaignCharacters = db.prepare(`
  SELECT c.id, c.player_user_id, c.name, c.archetype, c.portrait_url, c.sheet_data, c.created_at
  FROM characters c
  INNER JOIN campaign_characters cc ON cc.character_id = c.id
  WHERE cc.campaign_id = ?
  ORDER BY c.name
`);

// -----------------------------------------------------------------------------
// Character Queries
// -----------------------------------------------------------------------------

export function createCharacter(params: CreateCharacterParams): CharacterRow {
  stmtCreateCharacter.run({
    id: params.id,
    playerUserId: params.playerUserId,
    name: params.name,
    archetype: params.archetype,
    sheetData: params.sheetData,
  });
  return stmtFindById.get(params.id) as CharacterRow;
}

export function findById(characterId: string): CharacterRow | null {
  const row = stmtFindById.get(characterId) as CharacterRow | undefined;
  return row ?? null;
}

/** Find all characters owned by a user (their library). */
export function findByUserId(userId: string): CharacterRow[] {
  return stmtFindByUserId.all(userId) as CharacterRow[];
}

export function updateSheet(
  characterId: string,
  sheetDataJson: string,
  name?: string,
  archetype?: string,
): CharacterRow {
  stmtUpdateSheet.run({
    id: characterId,
    sheetData: sheetDataJson,
    name: name ?? null,
    archetype: archetype ?? null,
  });
  return stmtFindById.get(characterId) as CharacterRow;
}

export function deleteCharacter(characterId: string): void {
  stmtDelete.run(characterId);
}

// -----------------------------------------------------------------------------
// Campaign Roster Queries
// -----------------------------------------------------------------------------

/** Add a character to a campaign roster. No-op if already in campaign. */
export function addToCampaign(campaignId: string, characterId: string, addedBy: string): void {
  stmtAddToCampaign.run({ campaignId, characterId, addedBy });
}

/** Remove a character from a campaign roster (does not delete character). */
export function removeFromCampaign(campaignId: string, characterId: string): void {
  stmtRemoveFromCampaign.run({ campaignId, characterId });
}

/** Find all characters in a campaign roster (full rows via join table). */
export function findCampaignCharacters(campaignId: string): CharacterRow[] {
  return stmtFindCampaignCharacters.all(campaignId) as CharacterRow[];
}
