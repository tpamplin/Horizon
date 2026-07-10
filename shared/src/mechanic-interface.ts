// =============================================================================
// Horizon — Game Mechanic Plugin Interface
// =============================================================================
// The contract between the VTT core and all pluggable game mechanics.
// Every custom mechanic (Wild Magic, Fear Tracker, Chase Engine, etc.)
// implements the GameMechanic interface defined here.
//
// See plan/vtt-design-doc.md §4.8 for the full architectural rationale.
// =============================================================================

import type { FC } from 'react';
import type { Character, SheetData } from './types.js';

// -----------------------------------------------------------------------------
// Mechanic Category
// -----------------------------------------------------------------------------

/**
 * Classification of a game mechanic, used by the client to decide where
 * and how to render the mechanic's UI.
 *
 * - `dice` — Dice-based mechanics that produce rolls (e.g. Wild Magic).
 * - `tracker` — State-tracking mechanics with a numeric scale (e.g. Fear, Sanity).
 * - `generator` — Content generation mechanics (e.g. NPC Generator, Loot Tables).
 * - `narrative` — Story-driven mechanics that guide narrative flow (e.g. Clue Web, Chase Sequence).
 */
export type MechanicCategory = 'dice' | 'tracker' | 'generator' | 'narrative';

// -----------------------------------------------------------------------------
// Sheet Changes
// -----------------------------------------------------------------------------

/**
 * A partial update to a character's or NPC's sheet data.
 * Passed to the `onUpdateSheet` callback when a mechanic modifies character state.
 * Only the changed fields need to be present — the server merges them into
 * the existing sheet_data JSON column.
 */
export type SheetChanges = Partial<SheetData>;

// -----------------------------------------------------------------------------
// Mechanic Event (Client → Server)
// -----------------------------------------------------------------------------

/**
 * Payload sent from the client when a player or GM invokes a mechanic.
 * Routed through WebSocket (`mechanic:invoke`) to the server-side handler.
 */
export interface MechanicEvent {
  /** The ID of the mechanic being invoked (e.g. "wild-magic", "fear-tracker"). */
  mechanicId: string;
  /** The campaign in which the mechanic is being invoked. */
  campaignId: string;
  /** The character invoking the mechanic (optional — some mechanics are campaign-scoped). */
  characterId?: string;
  /**
   * Arbitrary parameters specific to this mechanic invocation.
   * Shape is defined by each mechanic's contract and validated server-side.
   */
  params: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Mechanic Result (Server → Client)
// -----------------------------------------------------------------------------

/**
 * Result returned by the server after executing a mechanic.
 * Broadcast to all players in the campaign via WebSocket (`mechanic:result`).
 */
export interface MechanicResult {
  /** The ID of the mechanic that produced this result. */
  mechanicId: string;
  /** The character this result pertains to (optional). */
  characterId?: string;
  /**
   * The mechanic's output data. Shape is mechanic-specific.
   * Examples: a Wild Magic spell description, a Fear check outcome,
   * a generated NPC object, a Chase scene resolution.
   */
  result: Record<string, unknown>;
  /** Whether the result was automatically posted to the campaign chat as an embed. */
  postedToChat: boolean;
}

// -----------------------------------------------------------------------------
// Mechanic Context (Server-Side Handler Environment)
// -----------------------------------------------------------------------------

/**
 * Server-side context provided to a mechanic's `serverHandler` function.
 * Gives the handler access to database operations, campaign state,
 * and the ability to broadcast events to connected clients.
 */
export interface MechanicContext {
  /** The campaign ID this mechanic invocation belongs to. */
  campaignId: string;
  /**
   * Database access object. Loosely typed here — the server layer provides
   * concrete model functions for querying characters, NPCs, sessions, etc.
   */
  db: unknown;
  /**
   * Broadcasts a WebSocket event to all connected clients in the campaign.
   * @param event — The event name (e.g. "sheet:updated", "dice:result").
   * @param payload — The event payload to broadcast.
   */
  broadcast: (event: string, payload: unknown) => void;
}

// -----------------------------------------------------------------------------
// Mechanic Props (React Component Props)
// -----------------------------------------------------------------------------

/**
 * Props passed to the React component that renders a mechanic's UI.
 * The component is mounted in the client when a player or GM opens the mechanic.
 */
export interface MechanicProps {
  /** The campaign this mechanic instance belongs to. */
  campaignId: string;
  /**
   * The character currently interacting with the mechanic.
   * Optional — some mechanics operate at the campaign level.
   */
  characterId?: string;
  /** All characters in the campaign, for mechanics that need to read cross-character state. */
  characters: Character[];
  /**
   * Called when the mechanic produces a result. The result is sent to the server
   * via WebSocket and broadcast to all campaign members.
   */
  onResult: (result: MechanicResult) => void;
  /**
   * Called when the mechanic needs to update a character's sheet data.
   * Sends a partial update to the server, which merges it into the
   * character's `sheet_data` JSON column and broadcasts the change.
   */
  onUpdateSheet: (characterId: string, changes: SheetChanges) => void;
}

// -----------------------------------------------------------------------------
// Game Mechanic (Plugin Interface)
// -----------------------------------------------------------------------------

/**
 * The plugin interface that every game mechanic must implement.
 *
 * Each mechanic is a self-contained module with:
 * - Metadata (id, name, description, category)
 * - A React component for its client-side UI
 * - An optional server-side handler for processing invocations
 *
 * Mechanics are registered in a central registry and enabled per-campaign
 * via `PUT /api/campaigns/:id/mechanics`.
 *
 * @example Built-in mechanics
 * ```ts
 * const wildMagic: GameMechanic = {
 *   id: 'wild-magic',
 *   name: 'Wild Magic Generator',
 *   description: 'Generates unpredictable magical effects when a spell goes awry.',
 *   category: 'dice',
 *   Component: WildMagicPanel,
 *   serverHandler: handleWildMagic,
 * };
 * ```
 */
export interface GameMechanic {
  /** Unique identifier for this mechanic (e.g. "wild-magic", "fear-tracker"). */
  id: string;
  /** Human-readable display name (e.g. "Wild Magic Generator"). */
  name: string;
  /** Short description of what the mechanic does. */
  description: string;
  /** Classification determining how the client renders and organizes this mechanic. */
  category: MechanicCategory;
  /** The React functional component that renders this mechanic's UI in the client. */
  Component: FC<MechanicProps>;
  /**
   * Optional server-side handler for processing mechanic invocations.
   * If omitted, the mechanic is client-only (e.g. a simple reference tool).
   * Receives the invocation event and server context; returns a result
   * that is broadcast to all campaign members.
   */
  serverHandler?: (event: MechanicEvent, ctx: MechanicContext) => Promise<MechanicResult>;
}
