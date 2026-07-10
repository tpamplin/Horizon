// =============================================================================
// Horizon — Campaign Service
// =============================================================================
// Business logic for campaign operations: creation, membership management.
// Pure functions that operate on validated input — they don't know about HTTP.
// =============================================================================

import { randomUUID, randomBytes } from 'node:crypto';
import {
  createCampaign as createCampaignInDb,
  findById,
  findByUserId,
  findByInviteCode,
  findPlayersByCampaign,
  findCharactersByCampaign,
  findMembership,
  addPlayer,
  removePlayer,
  type CampaignRow,
} from '../models/campaign.js';
import type { Campaign, CreateCampaignRequest, CampaignDetailResponse } from 'shared';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0/O/1/I to avoid confusion

// -----------------------------------------------------------------------------
// Error Types
// -----------------------------------------------------------------------------

/** Thrown when a campaign is not found. */
export class CampaignNotFoundError extends Error {
  constructor(campaignId: string) {
    super(`Campaign "${campaignId}" not found.`);
    this.name = 'CampaignNotFoundError';
  }
}

/** Thrown when campaign input validation fails. */
export class CampaignValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignValidationError';
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Map a snake_case database row to a camelCase Campaign object for API responses. */
function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    gmUserId: row.gm_user_id,
    activeBackgroundUrl: row.active_background_url,
    inviteCode: row.invite_code,
    rulesetVersion: row.ruleset_version,
    createdAt: row.created_at,
    playerCount: row.player_count,
  };
}

/**
 * Generate a short, unique, human-readable invite code.
 * Uses a subset of uppercase letters and digits that are visually distinct.
 * Retries if the generated code already exists in the database.
 *
 * @returns An 8-character uppercase alphanumeric code.
 */
function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH);
  let code = '';

  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const index = bytes[i]! % INVITE_CODE_CHARS.length;
    code += INVITE_CODE_CHARS[index];
  }

  // If by astronomically unlikely chance the code collides, retry
  if (findByInviteCode(code)) {
    return generateInviteCode();
  }

  return code;
}

// -----------------------------------------------------------------------------
// Service Functions
// -----------------------------------------------------------------------------

/**
 * Create a new campaign and assign the creator as GM.
 *
 * @param userId - The authenticated user creating the campaign.
 * @param input - Validated campaign creation input (name required, description optional).
 * @returns The newly created Campaign object (including the invite code).
 *
 * @throws {CampaignValidationError} If the name is empty or too short.
 */
export function createCampaign(userId: string, input: CreateCampaignRequest): Campaign {
  // Validate
  const name = input.name?.trim();
  if (!name || name.length < 2) {
    throw new CampaignValidationError(
      'Campaign name is required and must be at least 2 characters.',
    );
  }

  const description = input.description?.trim() ?? '';

  // Generate IDs
  const campaignId = randomUUID();
  const inviteCode = generateInviteCode();

  // Create in DB (transactional: campaign + GM membership)
  const row = createCampaignInDb({
    id: campaignId,
    name,
    description,
    gmUserId: userId,
    inviteCode,
  });

  return toCampaign(row);
}

/**
 * Get a single campaign by ID.
 * Does NOT check membership — this is a raw fetch for internal use.
 * Use with auth-guarded membership checks in routes.
 *
 * @returns The Campaign object, or null if not found.
 */
export function getCampaign(campaignId: string): Campaign | null {
  const row = findById(campaignId);
  if (!row) return null;
  return toCampaign(row);
}

/**
 * List all campaigns a user belongs to (as GM or player),
 * ordered by most recently created first.
 *
 * @returns An array of Campaign objects (empty array if none).
 */
export function listUserCampaigns(userId: string): Campaign[] {
  const rows = findByUserId(userId);
  return rows.map(toCampaign);
}

/**
 * Get a single campaign enriched with players and characters.
 * Used by GET /api/campaigns/:id to return the full CampaignDetailResponse.
 *
 * @throws {CampaignNotFoundError} If the campaign doesn't exist.
 */
export function getCampaignDetail(campaignId: string): CampaignDetailResponse {
  const row = findById(campaignId);
  if (!row) {
    throw new CampaignNotFoundError(campaignId);
  }

  const campaign = toCampaign(row);
  const players = findPlayersByCampaign(campaignId);
  const characters = findCharactersByCampaign(campaignId);

  return {
    ...campaign,
    players,
    characters,
  };
}

// -----------------------------------------------------------------------------
// Membership Mutations
// -----------------------------------------------------------------------------

/** Thrown when the invite code doesn't match any campaign. */
export class InviteCodeMismatchError extends Error {
  constructor() {
    super('Invalid invite code. No campaign found with that code.');
    this.name = 'InviteCodeMismatchError';
  }
}

/** Thrown when a user tries to join a campaign they're already a member of. */
export class AlreadyMemberError extends Error {
  constructor() {
    super('You are already a member of this campaign.');
    this.name = 'AlreadyMemberError';
  }
}

/** Thrown when the GM attempts to leave their own campaign. */
export class GMCannotLeaveError extends Error {
  constructor() {
    super('The GM cannot leave their own campaign. Delete the campaign instead.');
    this.name = 'GMCannotLeaveError';
  }
}

/**
 * Join a campaign using its invite code.
 * Validates the code matches a campaign and the user isn't already a member,
 * then adds them as a player.
 *
 * @returns The Campaign the user just joined.
 */
export function joinCampaign(userId: string, inviteCode: string): Campaign {
  const campaignRow = findByInviteCode(inviteCode);
  if (!campaignRow) {
    throw new InviteCodeMismatchError();
  }

  const existing = findMembership(campaignRow.id, userId);
  if (existing) {
    throw new AlreadyMemberError();
  }

  addPlayer(campaignRow.id, userId, 'player');
  return toCampaign(campaignRow);
}

/**
 * Leave a campaign. The GM cannot leave — they must delete the campaign instead.
 */
export function leaveCampaign(campaignId: string, userId: string): void {
  const membership = findMembership(campaignId, userId);
  if (!membership) {
    throw new CampaignNotFoundError(campaignId);
  }

  if (membership.role === 'gm') {
    throw new GMCannotLeaveError();
  }

  removePlayer(campaignId, userId);
}
