// =============================================================================
// Horizon — WeaponRollButton Component
// =============================================================================
// Attack roll button for weapon-type signature items on the character sheet.
// Only renders for items with itemType === 'weapon'.
// =============================================================================

import { useCallback } from 'react';
import { useDiceStore } from '../../stores/diceStore.js';
import { DIE_SIDES, STATS } from 'shared';
import type { SignatureItem } from 'shared';
import './WeaponRollButton.css';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface WeaponRollButtonProps {
  /** The weapon signature item. Only renders if itemType === 'weapon'. */
  item: SignatureItem;
  /** Character ID for logging the roll. */
  characterId?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function WeaponRollButton({ item, characterId }: WeaponRollButtonProps) {
  const isRolling = useDiceStore((s) => s.isRolling);
  const rollDice = useDiceStore((s) => s.rollDice);

  // Only render for weapon-type items
  if (item.itemType !== 'weapon') {
    return null;
  }

  // Determine the die size from the weapon's governing stat, or default to d6
  const weaponStatKey = item.weaponStat ?? 'force';
  const statDef = STATS[weaponStatKey as keyof typeof STATS];
  const dieSides = statDef ? DIE_SIDES[statDef.defaultDie] : 6;
  const attackBonus = item.attackBonus ?? 0;

  const handleRoll = useCallback(() => {
    if (isRolling) return;
    const expression = `1d${dieSides}`;
    const reason = `Attack with ${item.name}`;
    const mods = attackBonus !== 0
      ? { flatBonus: attackBonus, source: item.name }
      : undefined;
    rollDice(expression, reason, characterId, mods, 'weapon');
  }, [isRolling, dieSides, item.name, attackBonus, characterId, rollDice]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleRoll();
      }
    },
    [handleRoll],
  );

  const bonusLabel = attackBonus !== 0
    ? `${attackBonus > 0 ? '+' : ''}${attackBonus}`
    : null;

  return (
    <button
      type="button"
      className="weapon-roll-btn"
      onClick={handleRoll}
      onKeyDown={handleKeyDown}
      disabled={isRolling}
      aria-label={`Roll attack with ${item.name}`}
      title={`Roll 1d${dieSides}${bonusLabel ? ` ${bonusLabel}` : ''} for ${item.name}`}
    >
      <span className="weapon-roll-btn-icon">⚔️</span>
      <span className="weapon-roll-btn-label">Roll</span>
      {bonusLabel && (
        <span className={`roll-modifier ${attackBonus > 0 ? 'positive' : 'negative'}`}>
          {bonusLabel}
        </span>
      )}
    </button>
  );
}
