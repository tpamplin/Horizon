// =============================================================================
// Horizon — NPC Service
// =============================================================================
// Business logic for NPC operations. NPCs belong to users (not campaigns).
// They can be added to campaigns via the roster join table.
// =============================================================================

import { randomUUID } from 'node:crypto';
import {
  createNPC as createNPCInDb,
  findById,
  findByUserId,
  updateSheet as updateSheetInDb,
  deleteNPC as deleteNPCInDb,
  addToCampaign as addToCampaignInDb,
  removeFromCampaign as removeFromCampaignInDb,
  findCampaignNPCs,
  type NPCRow,
} from '../models/npc.js';
import { findMembership } from '../models/campaign.js';
import type {
  NPC,
  CreateNPCRequest,
  SheetData,
  UpdateNPCRequest,
  AddNPCToCampaignRequest,
} from 'shared';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const DEFAULT_SHEET_DATA: SheetData = {
  stats: {
    cognition: 'D10',
    force: 'D6',
    reflex: 'D12',
    conflict: 'D8',
    influence: 'D20',
    stability: 'D4',
  },
  adversityTokens: 0,
  strengths: [],
  flaws: [],
  traits: [],
  inventory: [],
  signatureItems: [],
  specialAbilities: [],
  conditions: [],
  customTracks: [],
  backstory: '',
  notes: '',
  campaignNotes: '',
};

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

export class NPCNotFoundError extends Error {
  constructor(npcId: string) {
    super(`NPC "${npcId}" not found.`);
    this.name = 'NPCNotFoundError';
  }
}

export class NPCValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NPCValidationError';
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function toNPC(row: NPCRow): NPC {
  let sheetData: SheetData;
  try {
    sheetData = JSON.parse(row.sheet_data) as SheetData;
  } catch {
    sheetData = { ...DEFAULT_SHEET_DATA };
  }

  return {
    id: row.id,
    playerUserId: row.player_user_id,
    name: row.name,
    archetype: row.archetype,
    portraitUrl: row.portrait_url,
    templateId: row.template_id,
    sheetData,
    isGenerated: row.is_generated === 1,
    createdAt: row.created_at,
  };
}

// -----------------------------------------------------------------------------
// Service Functions
// -----------------------------------------------------------------------------

export function createNPC(userId: string, input: CreateNPCRequest): NPC {
  const name = input.name?.trim();
  if (!name || name.length < 2)
    throw new NPCValidationError('NPC name is required and must be at least 2 characters.');
  const archetype = input.archetype?.trim();
  if (!archetype) throw new NPCValidationError('NPC archetype is required.');

  const sheetData: SheetData = { ...DEFAULT_SHEET_DATA, ...input.sheetData };
  const row = createNPCInDb({
    id: randomUUID(),
    playerUserId: userId,
    name,
    archetype,
    sheetData: JSON.stringify(sheetData),
  });
  return toNPC(row);
}

export function getNPC(npcId: string): NPC {
  const row = findById(npcId);
  if (!row) throw new NPCNotFoundError(npcId);
  return toNPC(row);
}

export function listUserNPCs(userId: string): NPC[] {
  return findByUserId(userId).map(toNPC);
}

export function updateNPC(userId: string, npcId: string, input: UpdateNPCRequest): NPC {
  const row = findById(npcId);
  if (!row) throw new NPCNotFoundError(npcId);
  if (row.player_user_id !== userId)
    throw new NPCValidationError('You can only edit your own NPCs.');

  const updatedRow = updateSheetInDb(npcId, JSON.stringify(input.sheetData));
  return toNPC(updatedRow);
}

export function deleteNPC(userId: string, npcId: string): void {
  const row = findById(npcId);
  if (!row) throw new NPCNotFoundError(npcId);
  if (row.player_user_id !== userId)
    throw new NPCValidationError('You can only delete your own NPCs.');
  deleteNPCInDb(npcId);
}

export function addNPCToCampaign(
  userId: string,
  campaignId: string,
  input: AddNPCToCampaignRequest,
): NPC {
  const membership = findMembership(campaignId, userId);
  if (!membership) throw new NPCValidationError('You are not a member of this campaign.');

  const npc = getNPC(input.npcId);
  addToCampaignInDb(campaignId, input.npcId, userId);
  return npc;
}

export function removeNPCFromCampaign(userId: string, campaignId: string, npcId: string): void {
  const membership = findMembership(campaignId, userId);
  if (!membership) throw new NPCValidationError('You are not a member of this campaign.');
  removeFromCampaignInDb(campaignId, npcId);
}

export function listCampaignNPCs(campaignId: string): NPC[] {
  return findCampaignNPCs(campaignId).map(toNPC);
}
