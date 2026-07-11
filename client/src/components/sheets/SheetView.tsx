// =============================================================================
// Horizon — SheetView Component
// =============================================================================
// Read-only character sheet view. Fetches character data on mount via the
// characterStore and renders all sheet sections: portrait, stats, traits,
// inventory, abilities, conditions, tracks, backstory, and notes.
// =============================================================================

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '../../stores/characterStore.js';
import { SheetEdit } from './SheetEdit.js';
import { STAT_KEYS, getStatDef } from 'shared';
import type { Character, StatKey, SheetData } from 'shared';
import './SheetView.css';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum stat value for progress bar scaling (numeric stats). */
const MAX_STAT_VALUE = 10;

/**
 * Label mapping from stat key to display name.
 * Fallback used when getStatDef is unavailable server-side.
 */
/* @unused — retained as fallback for edge cases */
// STAT_LABELS removed — using getStatDef() from shared/rules/stats instead

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Determine if a stat value is numeric or a die string. */
function isNumericStat(value: number | string): value is number {
  return typeof value === 'number';
}

/** Calculate the fill percentage for a stat bar (0–100). */
function statFillPercent(value: number | string): number {
  if (!isNumericStat(value)) return 50; // Die ratings get a default mid-fill
  return Math.min(100, Math.max(0, (value / MAX_STAT_VALUE) * 100));
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SheetView() {
  const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>();
  const navigate = useNavigate();

  const currentCharacter = useCharacterStore((s) => s.currentCharacter);
  const fetchCharacter = useCharacterStore((s) => s.fetchCharacter);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const setPortrait = useCharacterStore((s) => s.setPortrait);
  const saveState = useCharacterStore((s) => s.saveState);
  const loading = useCharacterStore((s) => s.loading);
  const error = useCharacterStore((s) => s.error);

  // GM status will be determined from campaignStore.gmUserId in a future story
  const isGM = false;

  const [editMode, setEditMode] = useState(false);
  const [backstoryOpen, setBackstoryOpen] = useState(false);

  // Fetch character on mount
  useEffect(() => {
    if (campaignId && characterId) {
      fetchCharacter(campaignId, characterId);
    }
    // Reset edit mode when changing characters
    setEditMode(false);
  }, [campaignId, characterId, fetchCharacter]);

  // Loading state
  if (loading || !currentCharacter) {
    return (
      <div className="sheet-loading" role="status" aria-label="Loading character sheet">
        <div className="spinner" />
        <p>{loading ? 'Loading character…' : error || 'Character not found.'}</p>
      </div>
    );
  }

  // Error state
  if (error && !currentCharacter) {
    return (
      <div className="sheet-error" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => navigate(-1)} className="sheet-back-btn">
          ← Back
        </button>
      </div>
    );
  }

  const char: Character = currentCharacter;
  const { sheetData } = char;

  // Edit mode — render SheetEdit
  if (editMode) {
    return (
      <SheetEdit
        character={char}
        saveState={saveState}
        isGM={isGM}
        onSave={(data: SheetData) => {
          if (campaignId && characterId) {
            updateCharacter(campaignId, characterId, data);
          }
        }}
        onPortraitChange={(url: string) => {
          setPortrait(url);
        }}
        onDone={() => setEditMode(false)}
      />
    );
  }

  // View mode — render SheetView
  const { stats, adversityTokens, strengths, flaws, traits, inventory, signatureItems, specialAbilities, conditions, customTracks, backstory, notes, campaignNotes } = sheetData;

  return (
    <article className="sheet-view" aria-label={`Character sheet for ${char.name}`}>
      {/* ---- Header: Portrait + Name ---- */}
      <header className="sheet-header">
        <div className="sheet-portrait">
          {char.portraitUrl ? (
            <img src={char.portraitUrl} alt={`Portrait of ${char.name}`} className="portrait-img" />
          ) : (
            <div className="portrait-placeholder" aria-hidden="true">
              {char.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="sheet-header-text">
          <h1 className="sheet-name">{char.name}</h1>
          <p className="sheet-archetype">{char.archetype}</p>
        </div>
        <button
          type="button"
          className="sheet-edit-btn"
          onClick={() => setEditMode(true)}
        >
          Edit
        </button>
      </header>

      {/* ---- Two-Column Body ---- */}
      <div className="sheet-body">
        {/* ---- Left Column ---- */}
        <div className="sheet-col">

          {/* Stats */}
          <section className="sheet-section" aria-label="Character stats">
            <h2 className="section-title">Stats</h2>
            <div className="stat-list">
              {STAT_KEYS.map((statKey: StatKey) => {
                const statDef = getStatDef(statKey);
                const value = stats[statKey] ?? 0;
                const fillPercent = statFillPercent(value);
                return (
                  <div key={statKey} className="stat-row">
                    <label className="stat-label" id={`stat-label-${statKey}`}>
                      {statDef?.name ?? statKey}
                    </label>
                    <div
                      className="stat-bar"
                      role="progressbar"
                      aria-valuenow={isNumericStat(value) ? value : undefined}
                      aria-valuemin={0}
                      aria-valuemax={isNumericStat(value) ? MAX_STAT_VALUE : undefined}
                      aria-labelledby={`stat-label-${statKey}`}
                    >
                      <div className="stat-fill" style={{ width: `${fillPercent}%` }} />
                      <span className="stat-value">{isNumericStat(value) ? value : value}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Adversity Tokens */}
          <section className="sheet-section" aria-label="Adversity tokens">
            <h2 className="section-title">Adversity Tokens</h2>
            <div className="tokens-display" aria-label={`${adversityTokens} adversity tokens`}>
              <span className="tokens-count">{adversityTokens}</span>
              <span className="tokens-label">tokens</span>
            </div>
          </section>

          {/* Strengths & Flaws */}
          {(strengths.length > 0 || flaws.length > 0) && (
            <section className="sheet-section" aria-label="Strengths and flaws">
              {strengths.length > 0 && (
                <div className="strength-list">
                  <h3 className="subsection-title">Strengths</h3>
                  <ul className="tag-list" aria-label="Strengths">
                    {strengths.map((s) => (
                      <li key={s} className="tag tag-strength">{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {flaws.length > 0 && (
                <div className="flaw-list">
                  <h3 className="subsection-title">Flaws</h3>
                  <ul className="tag-list" aria-label="Flaws">
                    {flaws.map((f) => (
                      <li key={f} className="tag tag-flaw">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Traits */}
          {traits.length > 0 && (
            <section className="sheet-section" aria-label="Traits">
              <h2 className="section-title">Traits</h2>
              <ul className="tag-list" aria-label="Character traits">
                {traits.map((t) => (
                  <li key={t} className="tag tag-trait">{t}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Conditions */}
          {conditions.length > 0 && (
            <section className="sheet-section" aria-label="Conditions">
              <h2 className="section-title">Conditions</h2>
              <ul className="tag-list" aria-label="Active conditions">
                {conditions.map((c) => (
                  <li key={c} className="tag tag-condition">{c}</li>
                ))}
              </ul>
            </section>
          )}

        </div>

        {/* ---- Right Column ---- */}
        <div className="sheet-col">

          {/* Inventory */}
          {inventory.length > 0 && (
            <section className="sheet-section" aria-label="Inventory">
              <h2 className="section-title">Inventory</h2>
              <ul className="inventory-list" aria-label="Inventory items">
                {inventory.map((item, i) => (
                  <li key={`${item.name}-${i}`} className="inventory-item">
                    <span className="inv-name">{item.name}</span>
                    {item.qty > 1 && <span className="inv-qty">×{item.qty}</span>}
                    {item.notes && <span className="inv-notes">{item.notes}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Signature Items */}
          {signatureItems.length > 0 && (
            <section className="sheet-section" aria-label="Signature items">
              <h2 className="section-title">Signature Items</h2>
              <ul className="sig-items-list" aria-label="Signature items">
                {signatureItems.map((item, i) => (
                  <li key={`${item.name}-${i}`} className="sig-item">
                    <strong className="sig-item-name">{item.name}</strong>
                    <p className="sig-item-desc">{item.description}</p>
                    {item.modifiers && <p className="sig-item-mod"><em>{item.modifiers}</em></p>}
                    {item.rules && <p className="sig-item-rules">{item.rules}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Special Abilities */}
          {specialAbilities.length > 0 && (
            <section className="sheet-section" aria-label="Special abilities">
              <h2 className="section-title">Special Abilities</h2>
              <ul className="abilities-list" aria-label="Special abilities">
                {specialAbilities.map((ab, i) => (
                  <li key={`${ab.name}-${i}`} className="ability-item">
                    <strong className="ability-name">{ab.name}</strong>
                    <p className="ability-effect">{ab.effect}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Custom Tracks */}
          {customTracks.length > 0 && (
            <section className="sheet-section" aria-label="Custom tracks">
              <h2 className="section-title">Custom Tracks</h2>
              <div className="tracks-list">
                {customTracks.map((track) => (
                  <div key={track.name} className="track-row">
                    <span className="track-name">{track.name}</span>
                    <span className="track-value">{track.current} / {track.max}</span>
                    {track.levels && track.levels.length > 0 && (
                      <div className="track-levels">
                        {track.levels
                          .filter((lvl) => lvl.atLevel <= track.current)
                          .map((lvl) => (
                            <div key={lvl.atLevel} className="track-level-item">
                              <span className="track-level-num">Lvl {lvl.atLevel}:</span>
                              <span className="track-level-desc">{lvl.description}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </div>

      {/* ---- Bottom Sections (full width) ---- */}

      {/* Backstory */}
      {backstory && (
        <section className="sheet-section sheet-section-full" aria-label="Backstory">
          <h2 className="section-title">
            <button
              type="button"
              className="expand-toggle"
              onClick={() => setBackstoryOpen(!backstoryOpen)}
              aria-expanded={backstoryOpen}
            >
              Backstory {backstoryOpen ? '▾' : '▸'}
            </button>
          </h2>
          {backstoryOpen && <p className="backstory-text">{backstory}</p>}
        </section>
      )}

      {/* Notes */}
      {notes && (
        <section className="sheet-section sheet-section-full" aria-label="Player notes">
          <h2 className="section-title">Notes</h2>
          <p className="notes-text">{notes}</p>
        </section>
      )}

      {/* Campaign Notes (GM only) */}
      {isGM && campaignNotes && (
        <section className="sheet-section sheet-section-full sheet-section-gm" aria-label="GM campaign notes">
          <h2 className="section-title">Campaign Notes (GM Only)</h2>
          <p className="notes-text">{campaignNotes}</p>
        </section>
      )}
    </article>
  );
}
