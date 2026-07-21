// =============================================================================
// Horizon — StatRollButton Component
// =============================================================================
// Clickable die button for character sheet stats. Shows stat name, die label,
// and a modifier badge. Part of the HZN-229 integration contract.
// =============================================================================

import { useCallback } from 'react';
import { useDiceStore } from '../../stores/diceStore.js';
import { STATS, DIE_SIDES } from 'shared';
import type { StatKey } from 'shared';
import './StatRollButton.css';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface StatRollButtonProps {
  /** Which stat this button rolls for. */
  statKey: StatKey;
  /** Total modifier from items/abilities (defaults to 0 — HZN-229 will populate). */
  modifier?: number;
  /** Character ID for logging the roll to the character's history. */
  characterId?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function StatRollButton({ statKey, modifier = 0, characterId }: StatRollButtonProps) {
  const isRolling = useDiceStore((s) => s.isRolling);
  const rollDice = useDiceStore((s) => s.rollDice);

  const statDef = STATS[statKey];
  const dieSides = DIE_SIDES[statDef.defaultDie];
  const statName = statDef.name;

  const handleRoll = useCallback(() => {
    if (isRolling) return;
    const expression = `1d${dieSides}`;
    const mods = modifier !== 0
      ? { statBonuses: { [statKey]: modifier }, source: `${statName} Modifier` }
      : undefined;
    rollDice(expression, statName, characterId, mods, 'stat');
  }, [isRolling, dieSides, statKey, statName, modifier, characterId, rollDice]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleRoll();
      }
    },
    [handleRoll],
  );

  const modifierClass =
    modifier > 0 ? 'positive' : modifier < 0 ? 'negative' : 'zero';
  const modifierSign = modifier > 0 ? '+' : '';

  return (
    <button
      type="button"
      className="stat-roll-btn"
      onClick={handleRoll}
      onKeyDown={handleKeyDown}
      disabled={isRolling}
      aria-label={`Roll ${statName} 1d${dieSides}, modifier ${modifierSign}${modifier}`}
      title={`Roll 1d${dieSides} for ${statName}`}
    >
      <span className="stat-roll-btn-die">{statDef.defaultDie}</span>
      <span className="stat-roll-btn-name">{statName}</span>
      <span className={`roll-modifier ${modifierClass}`} aria-hidden="true">
        {modifierSign}{modifier}
      </span>
    </button>
  );
}
