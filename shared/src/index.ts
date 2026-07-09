// Horizon — Shared package barrel export
// Re-exports all domain types, rules, and mechanic interfaces.

export type {
  CampaignRole,
  ChatMessageType,
  User,
  RefreshToken,
  Campaign,
  CampaignPlayer,
  Character,
  NPC,
  CharacterStats,
  InventoryItem,
  SignatureItem,
  SpecialAbility,
  TrackModifier,
  CustomTrack,
  SheetData,
  Session,
  SessionAttendance,
  DieResult,
  DiceRoll,
  DiceChatContent,
  SystemChatContent,
  ChatContent,
  ChatMessage,
} from './types.js';

export type {
  MechanicCategory,
  SheetChanges,
  MechanicEvent,
  MechanicResult,
  MechanicContext,
  MechanicProps,
  GameMechanic,
} from './mechanic-interface.js';

export type { DiceGroup, DicePool, RollResult, DieSides, ResolveOptions } from './rules/dice.js';

export { parseDicePool, resolveDiceRoll } from './rules/dice.js';
