// =============================================================================
// Horizon — DiceTray Component
// =============================================================================
// Dice expression input with Quick Roll buttons for d4–d20.
// Uses diceStore for shared roll state.
// =============================================================================

import { useState, useCallback, type KeyboardEvent } from 'react';
import { useDiceStore } from '../../stores/diceStore.js';
import './DiceTray.css';

// -----------------------------------------------------------------------------
// Quick Roll dice sizes
// -----------------------------------------------------------------------------

const QUICK_DICE = [4, 6, 8, 10, 12, 20] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function DiceTray() {
  const [input, setInput] = useState('');
  const isRolling = useDiceStore((s) => s.isRolling);
  const rollDice = useDiceStore((s) => s.rollDice);

  const handleRoll = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isRolling) return;
    rollDice(trimmed);
    // Don't clear input — let user re-roll or modify
  }, [input, isRolling, rollDice]);

  const handleQuickRoll = useCallback(
    (sides: number) => {
      const expr = `1d${sides}`;
      setInput(expr);
      rollDice(expr);
    },
    [rollDice],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRoll();
      }
    },
    [handleRoll],
  );

  return (
    <section className="dice-tray" aria-label="Dice roller">
      <div className="dice-tray-input-row">
        <input
          type="text"
          className="dice-tray-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. 3d6+2a-1"
          aria-label="Dice expression"
          disabled={isRolling}
        />
        <button
          type="button"
          className="dice-tray-roll-btn"
          onClick={handleRoll}
          disabled={isRolling || !input.trim()}
          aria-label="Roll dice"
        >
          {isRolling ? 'Rolling…' : 'Roll'}
        </button>
      </div>

      <div className="dice-tray-quick" role="group" aria-label="Quick roll buttons">
        {QUICK_DICE.map((sides) => (
          <button
            key={sides}
            type="button"
            className="dice-tray-quick-btn"
            onClick={() => handleQuickRoll(sides)}
            disabled={isRolling}
            aria-label={`Roll 1d${sides}`}
          >
            d{sides}
          </button>
        ))}
      </div>
    </section>
  );
}
