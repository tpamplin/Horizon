// =============================================================================
// Horizon — Character Service
// =============================================================================
// Business logic for character operations. Characters belong to users (not
// campaigns). They can be added to campaigns via the roster join table.
// =============================================================================

import { randomUUID } from 'node:crypto';
import {
  createCharacter as createCharacterInDb,
  findById,
  findByUserId,
  updateSheet as updateSheetInDb,
  deleteCharacter as deleteCharacterInDb,
  addToCampaign as addToCampaignInDb,
  removeFromCampaign as removeFromCampaignInDb,
  findCampaignCharacters,
  type CharacterRow,
} from '../models/character.js';
import { findMembership } from '../models/campaign.js';
import type {
  Character,
  CreateCharacterRequest,
  SheetData,
  UpdateCharacterRequest,
  AddCharacterToCampaignRequest,
} from 'shared';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Default empty sheet data applied when no initial data is provided. All stats unset by default. */
export const DEFAULT_SHEET_DATA: SheetData = {
  stats: {
    cognition: '',
    force: '',
    reflex: '',
    conflict: '',
    influence: '',
    stability: '',
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

export class CharacterNotFoundError extends Error {
  constructor(characterId: string) {
    super(`Character "${characterId}" not found.`);
    this.name = 'CharacterNotFoundError';
  }
}

export class CharacterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CharacterValidationError';
  }
}

export class CharacterAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CharacterAuthorizationError';
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function toCharacter(row: CharacterRow): Character {
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
    sheetData,
    createdAt: row.created_at,
  };
}

// -----------------------------------------------------------------------------
// Library CRUD (User-Scoped)
// -----------------------------------------------------------------------------

/** Create a character in the user's library. No campaign required. */
export function createCharacter(userId: string, input: CreateCharacterRequest): Character {
  const name = input.name?.trim();
  if (!name || name.length < 2) {
    throw new CharacterValidationError(
      'Character name is required and must be at least 2 characters.',
    );
  }
  const archetype = input.archetype?.trim();
  if (!archetype) {
    throw new CharacterValidationError('Character archetype is required.');
  }

  const sheetData: SheetData = { ...DEFAULT_SHEET_DATA, ...input.sheetData };
  const row = createCharacterInDb({
    id: randomUUID(),
    playerUserId: userId,
    name,
    archetype,
    sheetData: JSON.stringify(sheetData),
  });
  return toCharacter(row);
}

/** Get a single character by ID. */
export function getCharacter(characterId: string): Character {
  const row = findById(characterId);
  if (!row) throw new CharacterNotFoundError(characterId);
  return toCharacter(row);
}

/** List all characters in a user's library. */
export function listUserCharacters(userId: string): Character[] {
  return findByUserId(userId).map(toCharacter);
}

/** Update a character's sheet data and optionally name/archetype. Owner-only. */
export function updateSheet(
  userId: string,
  characterId: string,
  input: UpdateCharacterRequest,
): Character {
  const row = findById(characterId);
  if (!row) throw new CharacterNotFoundError(characterId);
  if (row.player_user_id !== userId) {
    throw new CharacterAuthorizationError('You can only edit your own characters.');
  }
  const updatedRow = updateSheetInDb(
    characterId,
    JSON.stringify(input.sheetData),
    input.name,
    input.archetype,
  );
  return toCharacter(updatedRow);
}

/** Delete a character from the library. Cascade deletes remove from all campaigns. Owner-only. */
export function deleteCharacter(userId: string, characterId: string): void {
  const row = findById(characterId);
  if (!row) throw new CharacterNotFoundError(characterId);
  if (row.player_user_id !== userId) {
    throw new CharacterAuthorizationError('You can only delete your own characters.');
  }
  deleteCharacterInDb(characterId);
}

// -----------------------------------------------------------------------------
// Campaign Roster (Join Table)
// -----------------------------------------------------------------------------

/** Add a character from the user's library to a campaign roster. */
export function addCharacterToCampaign(
  userId: string,
  campaignId: string,
  input: AddCharacterToCampaignRequest,
): void {
  // Verify the character exists and belongs to the user
  const char = findById(input.characterId);
  if (!char) throw new CharacterNotFoundError(input.characterId);

  // Verify the user is a campaign member
  const membership = findMembership(campaignId, userId);
  if (!membership) {
    throw new CharacterAuthorizationError('You are not a member of this campaign.');
  }

  // Owner can add own characters; GM can add any character
  if (char.player_user_id !== userId && membership.role !== 'gm') {
    throw new CharacterAuthorizationError('You can only add your own characters to a campaign.');
  }

  addToCampaignInDb(campaignId, input.characterId, userId);
}

/** Remove a character from a campaign roster. Does not delete the character. */
export function removeCharacterFromCampaign(
  userId: string,
  campaignId: string,
  characterId: string,
): void {
  const membership = findMembership(campaignId, userId);
  if (!membership) {
    throw new CharacterAuthorizationError('You are not a member of this campaign.');
  }
  // Only GM or the person who added the character can remove it
  // For simplicity: any campaign member can remove (GM can always veto)

  const char = findById(characterId);
  if (!char) throw new CharacterNotFoundError(characterId);

  removeFromCampaignInDb(campaignId, characterId);
}

/** List all characters in a campaign's roster. */
export function listCampaignRoster(campaignId: string): Character[] {
  return findCampaignCharacters(campaignId).map(toCharacter);
}
