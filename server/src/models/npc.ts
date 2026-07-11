// =============================================================================
// Horizon — NPC Model
// =============================================================================
// Database query functions for the npcs table and campaign roster.
// NPCs belong to users (player_user_id) — NOT campaigns. NPCs are added
// to campaigns via the campaign_npcs join table.
// =============================================================================

import db from './db.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Raw NPC row as returned from the database (snake_case columns). */
export interface NPCRow {
  id: string;
  player_user_id: string;
  name: string;
  archetype: string;
  portrait_url: string | null;
  template_id: string | null;
  is_generated: number; // SQLite boolean
  sheet_data: string;
  created_at: string;
}

/** Parameters for creating a new NPC. */
export interface CreateNPCParams {
  id: string;
  playerUserId: string;
  name: string;
  archetype: string;
  sheetData: string;
}

// -----------------------------------------------------------------------------
// Prepared Statements — NPCs
// -----------------------------------------------------------------------------

const stmtCreateNPC = db.prepare(`
  INSERT INTO npcs (id, player_user_id, name, archetype, portrait_url, template_id, sheet_data, is_generated, created_at)
  VALUES (@id, @playerUserId, @name, @archetype, NULL, NULL, @sheetData, 0, datetime('now'))
`);

const stmtFindById = db.prepare(`
  SELECT id, player_user_id, name, archetype, portrait_url, template_id, is_generated, sheet_data, created_at
  FROM npcs WHERE id = ?
`);

const stmtFindByUserId = db.prepare(`
  SELECT id, player_user_id, name, archetype, portrait_url, template_id, is_generated, sheet_data, created_at
  FROM npcs WHERE player_user_id = ? ORDER BY name
`);

const stmtUpdateSheet = db.prepare(`
  UPDATE npcs SET sheet_data = @sheetData WHERE id = @id
`);

const stmtDelete = db.prepare(`DELETE FROM npcs WHERE id = ?`);

// -----------------------------------------------------------------------------
// Prepared Statements — Campaign Roster
// -----------------------------------------------------------------------------

const stmtAddToCampaign = db.prepare(`
  INSERT OR IGNORE INTO campaign_npcs (campaign_id, npc_id, added_by)
  VALUES (@campaignId, @npcId, @addedBy)
`);

const stmtRemoveFromCampaign = db.prepare(`
  DELETE FROM campaign_npcs WHERE campaign_id = ? AND npc_id = ?
`);

const stmtFindCampaignNPCs = db.prepare(`
  SELECT n.id, n.player_user_id, n.name, n.archetype, n.portrait_url,
         n.template_id, n.is_generated, n.sheet_data, n.created_at
  FROM npcs n
  INNER JOIN campaign_npcs cn ON cn.npc_id = n.id
  WHERE cn.campaign_id = ?
  ORDER BY n.name
`);

const stmtFindCampaignsForNPC = db.prepare(`
  SELECT campaign_id FROM campaign_npcs WHERE npc_id = ?
`);

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export function createNPC(params: CreateNPCParams): NPCRow {
  stmtCreateNPC.run({
    id: params.id,
    playerUserId: params.playerUserId,
    name: params.name,
    archetype: params.archetype,
    sheetData: params.sheetData,
  });
  return stmtFindById.get(params.id) as NPCRow;
}

export function findById(npcId: string): NPCRow | null {
  return (stmtFindById.get(npcId) as NPCRow | undefined) ?? null;
}

export function findByUserId(userId: string): NPCRow[] {
  return stmtFindByUserId.all(userId) as NPCRow[];
}

export function updateSheet(npcId: string, sheetDataJson: string): NPCRow {
  stmtUpdateSheet.run({ id: npcId, sheetData: sheetDataJson });
  return stmtFindById.get(npcId) as NPCRow;
}

export function deleteNPC(npcId: string): void {
  stmtDelete.run(npcId);
}

// Roster queries

export function addToCampaign(campaignId: string, npcId: string, addedBy: string): void {
  stmtAddToCampaign.run({ campaignId, npcId, addedBy });
}

export function removeFromCampaign(campaignId: string, npcId: string): void {
  stmtRemoveFromCampaign.run(campaignId, npcId);
}

export function findCampaignNPCs(campaignId: string): NPCRow[] {
  return stmtFindCampaignNPCs.all(campaignId) as NPCRow[];
}

export function findCampaignsForNPC(npcId: string): string[] {
  const rows = stmtFindCampaignsForNPC.all(npcId) as { campaign_id: string }[];
  return rows.map((r) => r.campaign_id);
}
