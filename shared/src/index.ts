// Horizon — Shared package barrel export
// Re-exports all domain types, rules, and mechanic interfaces.

export type {
  CampaignRole,
  ChatMessageType,
  User,
  RefreshToken,
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  AuthResponse,
  Campaign,
  CampaignPlayer,
  CreateCampaignRequest,
  CampaignDetailResponse,
  CampaignPlayerDetail,
  CampaignCharacterBrief,
  CreateCharacterRequest,
  UpdateCharacterRequest,
  AddCharacterToCampaignRequest,
  CampaignCharacter,
  Character,
  NPC,
  StrengthEntry,
  FlawEntry,
  CampaignNPC,
  CreateNPCRequest,
  UpdateNPCRequest,
  AddNPCToCampaignRequest,
  CharacterStats,
  InventoryItem,
  SignatureItem,
  SignatureItemTemplate,
  CreateSignatureItemRequest,
  UpdateSignatureItemRequest,
  ItemType,
  ITEM_TYPES,
  WeaponType,
  WEAPON_TYPES,
  ItemModifier,
  SpecialAbility,
  AbilityTemplate,
  CreateAbilityRequest,
  UpdateAbilityRequest,
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

export type {
  StatKey,
  StatDefinition,
  CheckResult,
  CheckOptions,
  DieRating,
  StatFormat,
  ParsedStatValue,
} from './rules/stats.js';

export {
  STATS,
  STAT_KEYS,
  DIE_RATINGS,
  DIE_SIDES,
  DEFAULT_ADVERSITY_TOKENS,
  MIN_ADVERSITY_TOKENS,
  getStatDef,
  formatStatValue,
  parseStatValue,
  validateStatValue,
  awardAdversityTokens,
  deductAdversityTokens,
  checkSuccess,
  computeStatModifier,
} from './rules/stats.js';

export type { SkillKey } from './rules/skills.js';
export { SKILL_NAMES, SKILL_KEYS, getSkillName } from './rules/skills.js';
