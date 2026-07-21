// =============================================================================
// Horizon — DiceLogPanel Component
// =============================================================================
// Scrollable dice history panel for the campaign dice tab. Shows every roll
// with full detail: roller, timestamp, dice results, total, reason, and
// modifier breakdown. Polls for new entries periodically.
// =============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDiceStore } from '../../stores/diceStore.js';
import type { DiceRollResponse } from 'shared';
import './DiceLogPanel.css';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface DiceLogPanelProps {
  /** Campaign ID to fetch history for. */
  campaignId: string;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const SOURCE_ICONS: Record<string, string> = {
  stat: '📊',
  weapon: '⚔️',
  custom: '🎲',
};

const SOURCE_LABELS: Record<string, string> = {
  stat: 'Stat',
  weapon: 'Weapon',
  custom: 'Custom',
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatModifiers(modifiers: DiceRollResponse['modifiers']): string | null {
  if (!modifiers) return null;
  const parts: string[] = [];
  if (modifiers.statBonuses) {
    for (const [key, val] of Object.entries(modifiers.statBonuses)) {
      const sign = val > 0 ? '+' : '';
      parts.push(`${sign}${val} ${key}`);
    }
  }
  if (modifiers.flatBonus && modifiers.flatBonus !== 0) {
    const sign = modifiers.flatBonus > 0 ? '+' : '';
    parts.push(`${sign}${modifiers.flatBonus} flat`);
  }
  if (parts.length === 0) return null;
  const suffix = modifiers.source ? ` (${modifiers.source})` : '';
  return parts.join(', ') + suffix;
}

// -----------------------------------------------------------------------------
// Skeleton Component
// -----------------------------------------------------------------------------

function SkeletonEntry() {
  return (
    <div className="dl-entry dl-entry--skeleton" aria-hidden="true">
      <div className="dl-skeleton-line dl-skeleton-line--short" />
      <div className="dl-skeleton-line dl-skeleton-line--long" />
      <div className="dl-skeleton-line dl-skeleton-line--medium" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function DiceLogPanel({ campaignId }: DiceLogPanelProps) {
  const rollHistory = useDiceStore((s) => s.rollHistory);
  const fetchHistory = useDiceStore((s) => s.fetchHistory);
  const error = useDiceStore((s) => s.error);
  const listRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  // Fetch on mount + poll every 10 seconds
  useEffect(() => {
    let active = true;
    const load = async () => {
      await fetchHistory(campaignId);
      if (active) setLoading(false);
    };
    load();
    const interval = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [campaignId, fetchHistory]);

  // Auto-scroll to newest entry when new rolls arrive
  useEffect(() => {
    if (listRef.current && rollHistory.length > 0) {
      listRef.current.scrollTop = 0;
    }
  }, [rollHistory.length]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    fetchHistory(campaignId).finally(() => setLoading(false));
  }, [campaignId, fetchHistory]);

  // Loading state
  if (loading && rollHistory.length === 0) {
    return (
      <div className="dice-log-panel" role="status" aria-label="Loading dice history">
        <div className="dl-list">
          {[1, 2, 3].map((i) => <SkeletonEntry key={i} />)}
        </div>
      </div>
    );
  }

  // Error state
  if (error && rollHistory.length === 0) {
    return (
      <div className="dice-log-panel" role="alert">
        <div className="dl-empty">
          <p>Failed to load dice history.</p>
          <button type="button" className="dl-retry-btn" onClick={handleRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (rollHistory.length === 0) {
    return (
      <div className="dice-log-panel" role="status">
        <div className="dl-empty">
          <p>No dice rolls yet. Roll some dice to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dice-log-panel">
      <div
        className="dl-list"
        ref={listRef}
        role="list"
        aria-label="Dice roll history"
        aria-live="polite"
        tabIndex={0}
      >
        {rollHistory.map((entry) => {
          const source = entry.pool.source ?? 'custom';
          const sourceIcon = SOURCE_ICONS[source] ?? SOURCE_ICONS.custom;
          const sourceLabel = SOURCE_LABELS[source] ?? SOURCE_LABELS.custom;
          const modText = formatModifiers(entry.modifiers);
          const totalResult = entry.result.total;
          const dieCount = entry.result.dice.length;

          return (
            <div key={entry.id} className="dl-entry" role="listitem">
              <div className="dl-entry-header">
                <span className="dl-entry-source" title={`${sourceLabel} roll`}>
                  {sourceIcon} {sourceLabel}
                </span>
                <span className="dl-entry-user">{entry.roller_user_id}</span>
                <time className="dl-entry-time" dateTime={entry.created_at}>
                  {formatTime(entry.created_at)}
                </time>
              </div>

              <div className="dl-entry-body">
                <div className="dl-entry-dice" aria-label={`${dieCount} dice rolled`}>
                  {entry.result.dice.map((die, i) => {
                    const hasExplosion = die.explosionChain && die.explosionChain.length > 1;
                    const label = hasExplosion
                      ? `d${die.sides}: ${die.explosionChain!.join(' + ')} = ${die.result}`
                      : `d${die.sides}: ${die.result}`;
                    return (
                      <span
                        key={i}
                        className={`dl-die-pip${hasExplosion ? ' dl-die-pip--exploded' : ''}`}
                        aria-label={label}
                      >
                        {hasExplosion
                          ? die.explosionChain!.join(' + ') + ' = ' + die.result
                          : `d${die.sides}:${die.result}`}
                      </span>
                    );
                  })}
                  {entry.result.adversityResults.length > 0 && (
                    <span className="dl-adversity-label">
                      + {entry.result.adversityResults.length}a
                    </span>
                  )}
                </div>

                <div className="dl-entry-total" aria-label={`Total: ${totalResult}`}>
                  {totalResult}
                </div>
              </div>

              {entry.reason && (
                <div className="dl-entry-reason">{entry.reason}</div>
              )}

              {modText && (
                <div className="dl-entry-modifiers" aria-label="Modifiers applied">
                  {modText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
