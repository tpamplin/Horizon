// =============================================================================
// Horizon — SheetView Component
// =============================================================================
// Read-only character sheet view. Fetches character data on mount via the
// characterStore and renders all sheet sections: portrait, stats, traits,
// inventory, abilities, conditions, tracks, backstory, and notes.
// =============================================================================

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '../../stores/characterStore.js';
import { SheetEdit } from './SheetEdit.js';
import { STAT_KEYS, getStatDef, formatStatValue } from 'shared';
import type { Character, StatKey, SheetData } from 'shared';
import './SheetView.css';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SheetView() {
  const { campaignId, characterId } = useParams<{ campaignId: string; characterId: string }>();
  const navigate = useNavigate();

  const currentCharacter = useCharacterStore((s) => s.currentCharacter);
  const fetchCharacter = useCharacterStore((s) => s.fetchCharacter);
  const updateCharacter = useCharacterStore((s) => s.updateCharacter);
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter);
  const setPortrait = useCharacterStore((s) => s.setPortrait);
  const saveState = useCharacterStore((s) => s.saveState);
  const loading = useCharacterStore((s) => s.loading);
  const error = useCharacterStore((s) => s.error);

  // GM status will be determined from campaignStore.gmUserId in a future story
  const isGM = false;

  const [editMode, setEditMode] = useState(false);
  const [backstoryOpen, setBackstoryOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteModalRef = useRef<HTMLDivElement>(null);

  // Fetch character on mount
  useEffect(() => {
    if (characterId) {
      fetchCharacter(campaignId, characterId);
    }
    // Reset edit mode when changing characters
    setEditMode(false);
  }, [campaignId, characterId, fetchCharacter]);

  // Focus trap for delete confirmation modal
  useEffect(() => {
    if (!showDeleteModal) return;
    const modal = deleteModalRef.current;
    if (!modal) return;
    const timer = setTimeout(() => {
      const cancelBtn = modal.querySelector<HTMLElement>('button:not(.delete-confirm-btn)');
      cancelBtn?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDeleteModal(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDeleteModal]);

  const handleDelete = async () => {
    if (!characterId) return;
    setDeleting(true);
    try {
      await deleteCharacter(characterId);
      navigate(campaignId ? `/campaigns/${campaignId}` : '/characters', { replace: true });
    } catch {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="sheet-loading" role="status" aria-label="Loading character sheet">
        <div className="spinner" />
        <p>Loading character…</p>
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

  // Not found state
  if (!currentCharacter) {
    return (
      <div className="sheet-error" role="alert">
        <p>Character not found.</p>
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
        onSave={(data: SheetData, name?: string, archetype?: string) => {
          if (characterId) {
            updateCharacter(campaignId ?? '', characterId, data, name, archetype);
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
  const { stats, adversityTokens, strengths, flaws, signatureItems, specialAbilities, customTracks, backstory, campaignNotes } = sheetData;

  return (
    <article className="sheet-view" aria-label={`Character sheet for ${char.name}`}>
      {/* ---- Back Navigation ---- */}
      {!editMode && (
        <button
          type="button"
          className="sheet-back-btn sheet-back-top"
          onClick={() => navigate(campaignId ? `/campaigns/${campaignId}` : '/characters')}
          aria-label={campaignId ? 'Back to campaign' : 'Back to character library'}
        >
          ← Back
        </button>
      )}

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
        <div className="sheet-header-actions">
          <button
            type="button"
            className="sheet-edit-btn"
            onClick={() => setEditMode(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="sheet-delete-btn"
            onClick={() => setShowDeleteModal(true)}
            aria-label={`Delete ${char.name}`}
          >
            Delete
          </button>
        </div>
      </header>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div
          className="discard-overlay"
          role="alertdialog"
          aria-label="Confirm delete character"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}
          ref={deleteModalRef}
        >
          <div className="discard-modal">
            <h2>Delete {char.name}?</h2>
            <p>This will permanently delete this character and remove them from all campaigns. This action cannot be undone.</p>
            <div className="discard-modal-actions">
              <button
                type="button"
                className="discard-discard-btn delete-confirm-btn"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
              <button
                type="button"
                className="discard-keep-btn"
                onClick={() => setShowDeleteModal(false)}
                autoFocus
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Attributes + Adversity Strip ---- */}
      <section className="sheet-section sheet-attrs-tokens" aria-label="Character attributes and adversity tokens">
        <div className="attr-grid">
          {STAT_KEYS.map((statKey: StatKey) => {
            const statDef = getStatDef(statKey);
            const value = stats[statKey] ?? 0;
            const displayValue = formatStatValue(value);
            return (
              <div key={statKey} className="attr-card">
                <span className="attr-die">{displayValue}</span>
                <span className="attr-label">{statDef?.name ?? statKey}</span>
              </div>
            );
          })}
        </div>
        <div className="tokens-display" aria-label={`${adversityTokens} adversity tokens`}>
          <span className="tokens-count">{adversityTokens}</span>
          <span className="tokens-label">Adversity Tokens</span>
        </div>
      </section>

      {/* ---- Two Columns: Items (left) / Abilities (right) ---- */}
      <div className="sheet-body">
        <div className="sheet-col">
          {signatureItems.length > 0 && (
            <section className="sheet-section" aria-label="Signature items">
              <h2 className="section-title">Signature Items</h2>
              <ul className="sig-items-list">
                {signatureItems.map((item, i) => (
                  <li key={`${item.name}-${i}`} className="sig-item">
                    <strong className="sig-item-name">
                      {item.name}
                      {item.templateId && <span className="lib-badge" title="From Library" aria-label="From Library">📋</span>}
                    </strong>
                    <p className="sig-item-desc">{item.description}</p>
                    {item.modifiers && <p className="sig-item-mod"><em>{item.modifiers}</em></p>}
                    {item.rules && <p className="sig-item-rules">{item.rules}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="sheet-col">
          {specialAbilities.length > 0 && (
            <section className="sheet-section" aria-label="Special abilities">
              <h2 className="section-title">Special Abilities</h2>
              <ul className="abilities-list">
                {specialAbilities.map((ab, i) => (
                  <li key={`${ab.name}-${i}`} className="ability-item">
                    <strong className="ability-name">
                      {ab.name}
                      {ab.templateId && <span className="lib-badge" title="From Library" aria-label="From Library">📋</span>}
                    </strong>
                    <p className="ability-effect">{ab.effect}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* ---- Special Mechanics (placeholder) ---- */}
      <section className="sheet-section sheet-section-full sheet-section-mechanics" aria-label="Special mechanics">
        <h2 className="section-title">Special Mechanics</h2>
        <p className="mechanics-placeholder">No special mechanics active. The GM can enable mechanics like Wild Magic for this campaign.</p>
      </section>

      {/* ---- Strengths & Flaws (full width, two internal columns) ---- */}
      {(strengths.length > 0 || flaws.length > 0) && (
        <section className="sheet-section sheet-section-full" aria-label="Strengths and flaws">
          <h2 className="section-title">Strengths &amp; Flaws</h2>
          <div className="strength-flaw-grid">
            <div className="strength-list">
              <h3 className="subsection-title">Strengths</h3>
              {strengths.length === 0 && <p className="empty-hint">None</p>}
              <ul className="trait-entry-list">
                {strengths.map((s, i) => {
                  const entry = typeof s === 'string' ? { name: s, description: '' } : s;
                  return (
                    <li key={`str-${i}`} className="trait-entry trait-strength">
                      <RichTraitView entry={entry} />
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flaw-list">
              <h3 className="subsection-title">Flaws</h3>
              {flaws.length === 0 && <p className="empty-hint">None</p>}
              <ul className="trait-entry-list">
                {flaws.map((f, i) => {
                  const entry = typeof f === 'string' ? { name: f, description: '' } : f;
                  return (
                    <li key={`flw-${i}`} className="trait-entry trait-flaw">
                      <RichTraitView entry={entry} />
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ---- Custom Tracks ---- */}
      {customTracks.length > 0 && (
        <section className="sheet-section sheet-section-full" aria-label="Custom tracks">
          <h2 className="section-title">Custom Tracks</h2>
          <div className="tracks-list">
            {customTracks.map((track) => (
              <div key={track.name} className="track-row">
                <span className="track-name">{track.name}</span>
                <span className="track-value">{track.current} / {track.max}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- Backstory ---- */}
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

      {/* ---- Campaign Notes (GM only) ---- */}
      {isGM && campaignNotes && (
        <section className="sheet-section sheet-section-full sheet-section-gm" aria-label="GM campaign notes">
          <h2 className="section-title">Campaign Notes (GM Only)</h2>
          <p className="notes-text">{campaignNotes}</p>
        </section>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------
// RichTraitView — expandable strength/flaw entry
// -----------------------------------------------------------------------------

export interface TraitEntry {
  name: string;
  description: string;
}

export function RichTraitView({ entry }: { entry: TraitEntry }) {
  const [open, setOpen] = useState(false);
  const hasDesc = entry.description.length > 0;

  return (
    <div className="trait-entry-inner">
      <button
        type="button"
        className="trait-entry-toggle"
        onClick={() => hasDesc && setOpen(!open)}
        aria-expanded={hasDesc ? open : undefined}
        disabled={!hasDesc}
      >
        <span className="trait-entry-name">{entry.name}</span>
        {hasDesc && <span className="trait-entry-chevron">{open ? '▾' : '▸'}</span>}
      </button>
      {open && hasDesc && (
        <p className="trait-entry-desc">{entry.description}</p>
      )}
    </div>
  );
}
