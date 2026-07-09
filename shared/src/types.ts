// =============================================================================
// Horizon — Core Domain Types
// =============================================================================
// Shared by client and server. These types mirror the database schema defined
// in plan/vtt-design-doc.md §4.2 and drive all API contracts and WebSocket
// event payloads.
// =============================================================================

// -----------------------------------------------------------------------------
// Enums & Literal Unions
// -----------------------------------------------------------------------------

/**
 * Role a user holds within a specific campaign.
 * - `gm` — Game Master: full control over the campaign, all sheets, and settings.
 * - `player` — Player: controls assigned characters, rolls dice, participates in chat.
 */
export type CampaignRole = 'gm' | 'player';

/**
 * Type of a chat message, determining how the client renders it.
 * - `text` — Standard user-typed message.
 * - `dice` — Dice roll result embed (styled card).
 * - `system` — Automated system message (join/leave, background change, etc.).
 */
export type ChatMessageType = 'text' | 'dice' | 'system';

// -----------------------------------------------------------------------------
// User & Auth
// -----------------------------------------------------------------------------

/**
 * A registered user of the Horizon platform.
 * Users exist globally — campaign membership is tracked via CampaignPlayer.
 */
export interface User {
  /** Unique identifier (UUID or auto-increment integer). */
  id: string;
  /** Email address used for login. Must be unique across all users. */
  email: string;
  /** Display name shown to other players and the GM. */
  displayName: string;
  /** URL to the user's avatar image. May be a Gravatar URL or a local upload path. */
  avatarUrl: string | null;
  /** ISO 8601 timestamp of when the user registered. */
  createdAt: string;
}

/**
 * A hashed refresh token stored server-side for rotating JWT refresh.
 * Never exposed to the client in full — only the token value is sent.
 */
export interface RefreshToken {
  /** Unique identifier for the token record. */
  id: string;
  /** User that owns this refresh token. */
  userId: string;
  /** SHA-256 hash of the opaque refresh token string. */
  tokenHash: string;
  /** ISO 8601 timestamp of when this token expires. */
  expiresAt: string;
  /** ISO 8601 timestamp of when this token was created. */
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Campaign & Membership
// -----------------------------------------------------------------------------

/**
 * A Campaign is the top-level container for a game.
 * All characters, NPCs, sessions, dice rolls, and chat messages are scoped
 * to a single campaign. One GM, many players.
 */
export interface Campaign {
  /** Unique identifier. */
  id: string;
  /** Display name of the campaign (e.g. "The Hollow Creek Mystery"). */
  name: string;
  /** Short description or premise of the campaign. */
  description: string;
  /** User ID of the Game Master who created and owns this campaign. */
  gmUserId: string;
  /** URL or path to the currently active scene background image. */
  activeBackgroundUrl: string | null;
  /** Short alphanumeric code that players use to join the campaign. */
  inviteCode: string;
  /**
   * Ruleset or game system version this campaign uses.
   * Examples: "horizon-v1", "custom-pirate-rules".
   * Determines which mechanics plugins are active.
   */
  rulesetVersion: string;
  /** ISO 8601 timestamp of when the campaign was created. */
  createdAt: string;
}

/**
 * Links a user to a campaign with a specific role.
 * A user can be a GM in one campaign and a player in another.
 */
export interface CampaignPlayer {
  /** The campaign this membership belongs to. */
  campaignId: string;
  /** The user who is a member of the campaign. */
  userId: string;
  /** The role this user holds within the campaign. */
  role: CampaignRole;
}

// -----------------------------------------------------------------------------
// Characters & NPCs
// -----------------------------------------------------------------------------

/**
 * A player-controlled character within a campaign.
 * Each character is owned by one player and belongs to exactly one campaign.
 * The sheet_data JSON column stores all stats, inventory, traits, and
 * conditions — see SheetData for the structure.
 */
export interface Character {
  /** Unique identifier. */
  id: string;
  /** The campaign this character belongs to. */
  campaignId: string;
  /** The user (player) who controls this character. */
  playerUserId: string;
  /** Character name (e.g. "Jamie Reyes"). */
  name: string;
  /**
   * Character archetype, class, or identity label.
   * Examples: "Pirate Shapeshifter", "Small-Town Sheriff", "High School Nerd".
   */
  archetype: string;
  /** URL or path to the character's portrait image. */
  portraitUrl: string | null;
  /**
   * Full character sheet data as a JSON-friendly object.
   * Stored as a JSON text column in SQLite.
   */
  sheetData: SheetData;
  /** ISO 8601 timestamp of when this character was created. */
  createdAt: string;
}

/**
 * A non-player character (NPC) within a campaign.
 * NPCs can be generated from an archetype template or created manually by the GM.
 * They share the same sheet_data structure as Characters.
 */
export interface NPC {
  /** Unique identifier. */
  id: string;
  /** The campaign this NPC belongs to. */
  campaignId: string;
  /** Display name (e.g. "Sheriff Collins"). */
  name: string;
  /**
   * NPC archetype, role, or identity label.
   * Examples: "Corrupt Lawman", "Mysterious Outsider", "Town Bully".
   */
  archetype: string;
  /** URL or path to the NPC's portrait image. */
  portraitUrl: string | null;
  /** Archetype template ID if this NPC was generated; null if manual. */
  templateId: string | null;
  /**
   * Full NPC sheet data as a JSON-friendly object.
   * Same structure as Character sheet_data.
   */
  sheetData: SheetData;
  /** Whether this NPC was auto-generated from an archetype template. */
  isGenerated: boolean;
  /** ISO 8601 timestamp of when this NPC was created. */
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Sheet Data (JSON-friendly — per design doc §4.2)
// -----------------------------------------------------------------------------

/**
 * The six core stats in the Horizon game system.
 *
 * Horizon is a custom narrative TTRPG system — the rules are coded into the
 * software rather than written in a separate rulebook. Stats use one of two
 * formats depending on the campaign's ruleset configuration:
 * - **Numeric** (default Horizon system): integer values (e.g. `{ cognition: 3 }`)
 * - **Die rating** (alternate Horizon system): die size strings (e.g. `{ cognition: "D10" }`)
 *
 * All six stats are always present; individual rulesets determine valid ranges.
 */
export interface CharacterStats {
  /** Mental acuity, memory, book-smarts. */
  cognition: number | string;
  /** Physical strength, toughness, athleticism. */
  force: number | string;
  /** Agility, speed, hand-eye coordination. */
  reflex: number | string;
  /** Aggression, intimidation, physical confrontation. */
  conflict: number | string;
  /** Charisma, persuasion, social grace. */
  influence: number | string;
  /** Mental fortitude, composure, resistance to fear/madness. */
  stability: number | string;
}

/**
 * An item in a character's or NPC's general inventory.
 * For items with mechanical effects, see SignatureItem.
 */
export interface InventoryItem {
  /** Display name of the item. */
  name: string;
  /** Quantity carried. */
  qty: number;
  /** Optional freeform notes about the item. */
  notes: string;
}

/**
 * A signature or special item with mechanical effects.
 * Unlike regular inventory items, signature items provide bonuses,
 * modifiers, or special rules that affect gameplay.
 *
 * @example
 * ```json
 * {
 *   "name": "Pirate Hat",
 *   "description": "A weathered tricorn hat that commands respect.",
 *   "modifiers": "+5 to all deception, persuasion, and intimidation checks.",
 *   "rules": "Only the attuned wearer gains this bonus."
 * }
 * ```
 */
export interface SignatureItem {
  /** Display name of the item. */
  name: string;
  /** Flavor or functional description of the item. */
  description: string;
  /** Mechanical modifiers this item provides (e.g. "+2 to all influence rolls"). */
  modifiers?: string;
  /** Additional rules or constraints associated with this item. */
  rules?: string;
}

/**
 * A special ability, talent, or power possessed by a character or NPC.
 *
 * @example
 * ```json
 * {
 *   "name": "Shapeshifter",
 *   "effect": "Jeffrey is a true shapeshifter, not only gaining the appearance of any other creature, but also their physical attributes."
 * }
 * ```
 */
export interface SpecialAbility {
  /** Name of the ability (e.g. "Survivalist Chef", "Shapeshifter"). */
  name: string;
  /** Description of what the ability does, including mechanical effects and bonuses. */
  effect: string;
}

/**
 * A modifier applied at a specific level on a custom track.
 * Used by track-based mechanics like intoxication, fear, sanity, or corruption.
 */
export interface TrackModifier {
  /** The track value (0-indexed) this modifier applies at. */
  atLevel: number;
  /** Human-readable description of the effects at this level. */
  description: string;
  /**
   * Stat modifiers applied at this level.
   * Keys are stat names; values are the bonus or penalty (e.g. `{ "cognition": 5, "force": -5 }`).
   */
  statModifiers?: Record<string, number>;
  /** Additional rules or triggers that apply at this level. */
  rules?: string;
}

/**
 * A custom track for tracking a character's state along a numeric scale.
 * Supports per-level modifiers for mechanics like intoxication, fear, sanity,
 * corruption, hunger, or any other graduated condition.
 *
 * @example Intoxication Track (0–10)
 * ```json
 * {
 *   "name": "Intoxication",
 *   "min": 0,
 *   "max": 10,
 *   "current": 3,
 *   "levels": [
 *     { "atLevel": 0, "description": "Sober", "statModifiers": { "cognition": 5, "force": -5 } },
 *     { "atLevel": 5, "description": "The Perfect Buzz", "statModifiers": { "cognition": 3, "force": 3 } }
 *   ]
 * }
 * ```
 */
export interface CustomTrack {
  /** Display name of the track (e.g. "Intoxication", "Fear", "Sanity"). */
  name: string;
  /** Minimum value of the track (typically 0). */
  min: number;
  /** Maximum value of the track. */
  max: number;
  /** Current position on the track. */
  current: number;
  /** Per-level modifiers and rules. */
  levels?: TrackModifier[];
}

/**
 * Complete sheet data for a Character or NPC.
 * This is the JSON shape stored in the `sheet_data` column.
 * All values are JSON-primitive-friendly — no classes, Dates, Maps, or Sets.
 */
export interface SheetData {
  /** The six core character stats (numeric or die-rating format). */
  stats: CharacterStats;
  /** Current adversity tokens the character holds. */
  adversityTokens: number;
  /**
   * Defining strengths and positive character traits.
   * Freeform strings describing what the character excels at.
   */
  strengths: string[];
  /**
   * Defining flaws, weaknesses, or negative character traits.
   * Freeform strings describing the character's shortcomings.
   */
  flaws: string[];
  /**
   * General character traits (e.g. "Brave", "Clumsy").
   * For structured strengths/flaws, use the dedicated fields above.
   */
  traits: string[];
  /** General inventory items the character is carrying. */
  inventory: InventoryItem[];
  /**
   * Signature or special items with mechanical effects.
   * These are iconic items that provide bonuses or special rules.
   */
  signatureItems: SignatureItem[];
  /**
   * Special abilities, talents, or powers the character possesses.
   */
  specialAbilities: SpecialAbility[];
  /** Active conditions or status effects (e.g. "Shaken", "Injured"). */
  conditions: string[];
  /**
   * Custom tracks for graduated character states.
   * Examples: Intoxication (0–10), Fear (0–20), Sanity (100–0), Corruption (0–50).
   */
  customTracks: CustomTrack[];
  /**
   * The character's backstory — personal history, motivations, and key life events.
   * Rich text; may be multiple paragraphs.
   */
  backstory: string;
  /** Freeform GM or player notes about the character. */
  notes: string;
  /**
   * Campaign-specific notes that the GM attaches to this character.
   * Separate from general notes — these are plot hooks, secrets, or session-specific
   * reminders visible only to the GM.
   */
  campaignNotes: string;
}

// -----------------------------------------------------------------------------
// Sessions & Attendance
// -----------------------------------------------------------------------------

/**
 * A single play session within a campaign.
 * Tracks when the group played and provides a container for dice logs
 * and chat messages from that session.
 */
export interface Session {
  /** Unique identifier. */
  id: string;
  /** The campaign this session belongs to. */
  campaignId: string;
  /** ISO 8601 date of the play session. */
  date: string;
  /** Short summary or title for the session (e.g. "Chapter 3: The Warehouse"). */
  summary: string;
  /** Freeform GM notes about what happened during the session. */
  notes: string;
}

/**
 * Records which users and characters participated in a session.
 */
export interface SessionAttendance {
  /** The session this attendance record belongs to. */
  sessionId: string;
  /** The user who attended. */
  userId: string;
  /** The character the user played during this session (optional — GM may not play a character). */
  characterId: string | null;
}

// -----------------------------------------------------------------------------
// Dice
// -----------------------------------------------------------------------------

/**
 * A single die result within a dice roll.
 */
export interface DieResult {
  /** The number of sides on this die (e.g. 6 for a d6). */
  sides: number;
  /** The result rolled on this die (1–sides). */
  result: number;
}

/**
 * A complete dice roll, logged immutably by the server.
 * All RNG happens server-side; the client only requests rolls.
 */
export interface DiceRoll {
  /** Unique identifier for this roll. */
  id: string;
  /** The campaign this roll belongs to. */
  campaignId: string;
  /** The session this roll occurred during (may be null for out-of-session rolls). */
  sessionId: string | null;
  /** The user who requested the roll. */
  rollerUserId: string;
  /** The character the roll was made for (optional — may be a freeform roll). */
  characterId: string | null;
  /** The dice pool expression (e.g. "3d6+2a" or "2d8+1d6"). */
  pool: string;
  /** Individual die results that make up this roll. */
  results: DieResult[];
  /** Sum of all die results (for standard rolls). */
  total: number;
  /** Why the roll was made (e.g. "Cognition check", "Initiative"). */
  reason: string;
  /** ISO 8601 timestamp of when the roll occurred. */
  rolledAt: string;
}

// -----------------------------------------------------------------------------
// Chat
// -----------------------------------------------------------------------------

/**
 * Content payload for a dice embed chat message.
 * Rendered as a styled card showing pool and result.
 */
export interface DiceChatContent {
  /** The dice pool expression rolled. */
  pool: string;
  /** Individual die results. */
  results: DieResult[];
  /** Sum total of the roll. */
  total: number;
  /** Why the roll was made. */
  reason: string;
}

/**
 * Content payload for a system chat message.
 * Used for automated events like player join/leave, background changes, etc.
 */
export interface SystemChatContent {
  /** Machine-readable event key (e.g. "player_joined", "background_changed"). */
  event: string;
  /** Human-readable message (e.g. "Alice joined the campaign"). */
  message: string;
}

/**
 * Union of all possible chat message content shapes, discriminated by type.
 */
export type ChatContent = string | DiceChatContent | SystemChatContent;

/**
 * A single chat message within a campaign session.
 * Messages can be standard text, dice roll embeds, or system notifications.
 */
export interface ChatMessage {
  /** Unique identifier. */
  id: string;
  /** The campaign this message belongs to. */
  campaignId: string;
  /** The session this message was sent during (may be null for out-of-session chat). */
  sessionId: string | null;
  /** The user who sent this message (null for system messages without a sender). */
  userId: string | null;
  /** The type of message, determining how the client renders it. */
  type: ChatMessageType;
  /**
   * The message content. Shape depends on `type`:
   * - `text` → string
   * - `dice` → DiceChatContent
   * - `system` → SystemChatContent
   */
  content: ChatContent;
  /** ISO 8601 timestamp of when the message was sent. */
  sentAt: string;
}
