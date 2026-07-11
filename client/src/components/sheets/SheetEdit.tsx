// =============================================================================
// Horizon — SheetEdit Component
// =============================================================================
// Editable character sheet. Receives a Character and renders every sheet
// section with form controls. Changes save on blur with a debounced PUT.
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { STAT_KEYS, getStatDef, formatStatValue, parseStatValue, DIE_RATINGS } from 'shared';
import type {
  Character,
  SheetData,
  StatKey,
  DieRating,
  InventoryItem,
  SignatureItem,
  SpecialAbility,
} from 'shared';
import type { SaveState } from '../../stores/characterStore.js';
import { PortraitUpload } from './PortraitUpload.js';
import './SheetEdit.css';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface SheetEditProps {
  character: Character;
  saveState: SaveState;
  isGM: boolean;
  onSave: (sheetData: SheetData) => void;
  onPortraitChange: (url: string) => void;
  onDone: () => void;
}

/** Debounce timer for save-on-blur. */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DEBOUNCE_MS = 300;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Clamp a numeric stat between 0 and 10. */
function clampStat(value: number): number {
  return Math.min(10, Math.max(0, value));
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SheetEdit({ character, saveState, isGM, onSave, onPortraitChange, onDone }: SheetEditProps) {
  const [sheetData, setSheetData] = useState<SheetData>(
    () => structuredClone(character.sheetData) as SheetData,
  );
  const [saveMsg, setSaveMsg] = useState<string>('');
  const editRef = useRef<HTMLDivElement>(null);

  // Focus the first input on mount
  useEffect(() => {
    const firstInput = editRef.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, button',
    );
    firstInput?.focus();
  }, []);

  // Reflect save state changes
  useEffect(() => {
    if (saveState === 'saving') setSaveMsg('Saving…');
    else if (saveState === 'saved') setSaveMsg('Saved');
    else if (saveState === 'error') setSaveMsg('Save failed — reverted');
    else setSaveMsg('');
  }, [saveState]);

  // Debounced save
  const scheduleSave = useCallback(
    (updated: SheetData) => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        onSave(updated);
        saveTimer = null;
      }, SAVE_DEBOUNCE_MS);
    },
    [onSave],
  );

  // Update a single stat (numeric delta)
  const changeStat = (key: StatKey, delta: number) => {
    const current = sheetData.stats[key];
    if (typeof current !== 'number') return;
    const updated: SheetData = {
      ...sheetData,
      stats: { ...sheetData.stats, [key]: clampStat(current + delta) },
    };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Change stat die rating
  const changeStatDie = (key: StatKey, die: DieRating) => {
    const updated: SheetData = {
      ...sheetData,
      stats: { ...sheetData.stats, [key]: die },
    };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Adversity tokens
  const changeTokens = (delta: number) => {
    const updated: SheetData = {
      ...sheetData,
      adversityTokens: Math.max(0, sheetData.adversityTokens + delta),
    };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Tag list helpers (traits/conditions still use plain strings)
  const addTag = (field: 'traits' | 'conditions', value: string) => {
    if (!value.trim()) return;
    const updated: SheetData = { ...sheetData, [field]: [...sheetData[field], value.trim()] };
    setSheetData(updated);
    scheduleSave(updated);
  };

  const removeTag = (field: 'traits' | 'conditions', index: number) => {
    const updated: SheetData = {
      ...sheetData,
      [field]: sheetData[field].filter((_, i) => i !== index),
    };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Rich strength/flaw helpers
  const addRichEntry = (field: 'strengths' | 'flaws') => {
    const updated: SheetData = {
      ...sheetData,
      [field]: [...(sheetData[field] as { name: string; description: string }[]), { name: '', description: '' }],
    };
    setSheetData(updated);
  };

  const updateRichEntry = (field: 'strengths' | 'flaws', index: number, entry: { name: string; description: string }) => {
    const items = [...(sheetData[field] as { name: string; description: string }[])];
    items[index] = entry;
    const updated: SheetData = { ...sheetData, [field]: items };
    setSheetData(updated);
    scheduleSave(updated);
  };

  const removeRichEntry = (field: 'strengths' | 'flaws', index: number) => {
    const updated: SheetData = {
      ...sheetData,
      [field]: (sheetData[field] as { name: string; description: string }[]).filter((_, i) => i !== index),
    };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Inventory
  const updateInventoryItem = (index: number, item: InventoryItem) => {
    const inv = [...sheetData.inventory];
    inv[index] = item;
    const updated: SheetData = { ...sheetData, inventory: inv };
    setSheetData(updated);
    scheduleSave(updated);
  };

  const addInventoryItem = () => {
    const updated: SheetData = {
      ...sheetData,
      inventory: [...sheetData.inventory, { name: '', qty: 1, notes: '' }],
    };
    setSheetData(updated);
  };

  const removeInventoryItem = (index: number) => {
    const updated: SheetData = {
      ...sheetData,
      inventory: sheetData.inventory.filter((_, i) => i !== index),
    };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Signature items
  const updateSigItem = (index: number, item: SignatureItem) => {
    const items = [...sheetData.signatureItems];
    items[index] = item;
    setSheetData({ ...sheetData, signatureItems: items });
    scheduleSave({ ...sheetData, signatureItems: items });
  };

  const addSigItem = () => {
    const updated: SheetData = {
      ...sheetData,
      signatureItems: [...sheetData.signatureItems, { name: '', description: '' }],
    };
    setSheetData(updated);
  };

  const removeSigItem = (index: number) => {
    const updated: SheetData = {
      ...sheetData,
      signatureItems: sheetData.signatureItems.filter((_, i) => i !== index),
    };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Special abilities
  const updateAbility = (index: number, ab: SpecialAbility) => {
    const abs = [...sheetData.specialAbilities];
    abs[index] = ab;
    setSheetData({ ...sheetData, specialAbilities: abs });
    scheduleSave({ ...sheetData, specialAbilities: abs });
  };

  const addAbility = () => {
    const updated: SheetData = {
      ...sheetData,
      specialAbilities: [...sheetData.specialAbilities, { name: '', effect: '' }],
    };
    setSheetData(updated);
  };

  const removeAbility = (index: number) => {
    const updated: SheetData = {
      ...sheetData,
      specialAbilities: sheetData.specialAbilities.filter((_, i) => i !== index),
    };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Custom tracks
  const updateTrackValue = (index: number, delta: number) => {
    const tracks = [...sheetData.customTracks];
    const t = { ...tracks[index]! };
    t.current = Math.min(t.max, Math.max(t.min, t.current + delta));
    tracks[index] = t;
    const updated: SheetData = { ...sheetData, customTracks: tracks };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Blur handler for text fields
  const onBlurSave = useCallback(() => {
    if (saveTimer) clearTimeout(saveTimer);
    onSave(sheetData);
  }, [sheetData, onSave]);

  // Text field update
  const updateTextField = useCallback(
    (field: 'backstory' | 'notes' | 'campaignNotes', value: string) => {
      const updated: SheetData = { ...sheetData, [field]: value };
      setSheetData(updated);
    },
    [sheetData],
  );

  const { stats, adversityTokens, inventory, signatureItems, specialAbilities, customTracks, backstory, notes, campaignNotes } = sheetData;

  return (
    <article className="sheet-edit" ref={editRef} aria-label={`Editing character sheet for ${character.name}`}>
      {/* Header */}
      <header className="sheet-edit-header">
        <h1 className="sheet-edit-name">{character.name}</h1>
        <p className="sheet-edit-archetype">{character.archetype}</p>
        <div className="sheet-edit-actions">
          <span className={`save-indicator save-${saveState}`} aria-live="polite">
            {saveMsg}
          </span>
          <button type="button" className="done-btn" onClick={onDone}>
            Done
          </button>
        </div>
      </header>

      <div className="sheet-edit-body">
        <div className="sheet-edit-col">
          {/* Stats */}
          <section className="edit-section" aria-label="Edit character stats">
            <h2 className="edit-section-title">Stats</h2>
            {STAT_KEYS.map((key: StatKey) => {
              const def = getStatDef(key);
              const value = stats[key];
              const parsed = parseStatValue(value);
              const isDie = parsed.format === 'die';
              const numVal = typeof value === 'number' ? value : 0;
              const dieVal = (parsed.format === 'die' && parsed.die) ? parsed.die : def?.defaultDie ?? 'D10';
              const display = formatStatValue(value);
              return (
                <div key={key} className="edit-stat-row">
                  <label className="edit-stat-label" id={`edit-stat-${key}`}>
                    {def?.name ?? key}
                  </label>
                  <div className="edit-stat-controls">
                    {isDie ? (
                      <>
                        <select
                          className="edit-stat-die-select"
                          value={dieVal}
                          onChange={(e) => changeStatDie(key, e.target.value as DieRating)}
                          aria-label={`Die rating for ${def?.name ?? key}`}
                        >
                          {DIE_RATINGS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="stat-btn"
                          onClick={() => changeStat(key, -1)}
                          disabled={numVal <= 0}
                          aria-label={`Decrease ${def?.name ?? key} from ${numVal} to ${numVal - 1}`}
                        >
                          −
                        </button>
                        <span className="edit-stat-value" aria-labelledby={`edit-stat-${key}`}>
                          {display}
                        </span>
                        <button
                          type="button"
                          className="stat-btn"
                          onClick={() => changeStat(key, 1)}
                          disabled={numVal >= 10}
                          aria-label={`Increase ${def?.name ?? key} from ${numVal} to ${numVal + 1}`}
                        >
                          +
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {/* Adversity Tokens */}
          <section className="edit-section" aria-label="Edit adversity tokens">
            <h2 className="edit-section-title">Adversity Tokens</h2>
            <div className="edit-tokens">
              <button
                type="button"
                className="token-btn"
                onClick={() => changeTokens(-1)}
                disabled={adversityTokens <= 0}
                aria-label={`Remove one adversity token, currently ${adversityTokens}`}
              >
                −
              </button>
              <span className="edit-tokens-value">{adversityTokens}</span>
              <button
                type="button"
                className="token-btn"
                onClick={() => changeTokens(1)}
                aria-label={`Add one adversity token, currently ${adversityTokens}`}
              >
                +
              </button>
            </div>
          </section>

          {/* Strengths & Flaws (rich entries) */}
          {(['strengths', 'flaws'] as const).map((field) => {
            const items = (sheetData[field] as { name: string; description: string }[]);
            const label = field === 'strengths' ? 'Strengths' : 'Flaws';
            return (
              <section key={field} className="edit-section" aria-label={`Edit ${label}`}>
                <h2 className="edit-section-title">{label}</h2>
                {items.map((entry, i) => (
                  <div key={i} className="edit-rich-entry">
                    <input
                      className="edit-input"
                      value={entry.name}
                      onChange={(e) => updateRichEntry(field, i, { ...entry, name: e.target.value })}
                      onBlur={onBlurSave}
                      placeholder={`${label.slice(0, -1)} name`}
                      aria-label={`${label.slice(0, -1)} ${i + 1} name`}
                    />
                    <textarea
                      className="edit-textarea edit-textarea-sm"
                      value={entry.description}
                      onChange={(e) => updateRichEntry(field, i, { ...entry, description: e.target.value })}
                      onBlur={onBlurSave}
                      placeholder="Description…"
                      rows={2}
                      aria-label={`${label.slice(0, -1)} ${i + 1} description`}
                    />
                    <button
                      type="button"
                      className="item-remove-btn"
                      onClick={() => removeRichEntry(field, i)}
                      aria-label={`Remove ${entry.name || label.toLowerCase()}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="add-item-btn" onClick={() => addRichEntry(field)}>
                  + Add {label.slice(0, -1)}
                </button>
              </section>
            );
          })}

          {/* Traits & Conditions (simple tags) */}
          {(['traits', 'conditions'] as const).map((field) => {
            const items = sheetData[field] as string[];
            const label = field === 'traits' ? 'Traits' : 'Conditions';
            return (
              <section key={field} className="edit-section" aria-label={`Edit ${label}`}>
                <h2 className="edit-section-title">{label}</h2>
                <ul className="edit-tag-list">
                  {items.map((t, i) => (
                    <li key={`${t}-${i}`} className="edit-tag-item">
                      <span className={`tag tag-${field === 'conditions' ? 'condition' : 'trait'}`}>
                        {t}
                      </span>
                      <button
                        type="button"
                        className="tag-remove-btn"
                        onClick={() => removeTag(field, i)}
                        aria-label={`Remove ${t} from ${label}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
                <TagInput onAdd={(v) => addTag(field, v)} placeholder={`Add ${label.toLowerCase()}…`} />
              </section>
            );
          })}
        </div>

        <div className="sheet-edit-col">
          {/* Inventory */}
          <section className="edit-section" aria-label="Edit inventory">
            <h2 className="edit-section-title">Inventory</h2>
            {inventory.map((item, i) => (
              <div key={i} className="edit-inv-row">
                <input
                  className="edit-input inv-name-input"
                  value={item.name}
                  onChange={(e) => updateInventoryItem(i, { ...item, name: e.target.value })}
                  onBlur={onBlurSave}
                  placeholder="Item name"
                  aria-label={`Inventory item ${i + 1} name`}
                />
                <input
                  className="edit-input inv-qty-input"
                  type="number"
                  min={1}
                  value={item.qty}
                  onChange={(e) =>
                    updateInventoryItem(i, { ...item, qty: Math.max(1, Number(e.target.value) || 1) })
                  }
                  onBlur={onBlurSave}
                  aria-label={`Inventory item ${i + 1} quantity`}
                />
                <input
                  className="edit-input inv-notes-input"
                  value={item.notes}
                  onChange={(e) => updateInventoryItem(i, { ...item, notes: e.target.value })}
                  onBlur={onBlurSave}
                  placeholder="Notes"
                  aria-label={`Inventory item ${i + 1} notes`}
                />
                <button
                  type="button"
                  className="item-remove-btn"
                  onClick={() => removeInventoryItem(i)}
                  aria-label={`Remove ${item.name || 'item'} from inventory`}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="add-item-btn" onClick={addInventoryItem}>
              + Add Item
            </button>
          </section>

          {/* Signature Items */}
          <section className="edit-section" aria-label="Edit signature items">
            <h2 className="edit-section-title">Signature Items</h2>
            {signatureItems.map((item, i) => (
              <div key={i} className="edit-sig-row">
                <input
                  className="edit-input"
                  value={item.name}
                  onChange={(e) => updateSigItem(i, { ...item, name: e.target.value })}
                  onBlur={onBlurSave}
                  placeholder="Item name"
                  aria-label={`Signature item ${i + 1} name`}
                />
                <input
                  className="edit-input"
                  value={item.description}
                  onChange={(e) => updateSigItem(i, { ...item, description: e.target.value })}
                  onBlur={onBlurSave}
                  placeholder="Description"
                  aria-label={`Signature item ${i + 1} description`}
                />
                <input
                  className="edit-input"
                  value={item.modifiers ?? ''}
                  onChange={(e) => updateSigItem(i, { ...item, modifiers: e.target.value || undefined })}
                  onBlur={onBlurSave}
                  placeholder="Modifiers (e.g. +2 influence)"
                  aria-label={`Signature item ${i + 1} modifiers`}
                />
                <input
                  className="edit-input"
                  value={item.rules ?? ''}
                  onChange={(e) => updateSigItem(i, { ...item, rules: e.target.value || undefined })}
                  onBlur={onBlurSave}
                  placeholder="Rules"
                  aria-label={`Signature item ${i + 1} rules`}
                />
                <button
                  type="button"
                  className="item-remove-btn"
                  onClick={() => removeSigItem(i)}
                  aria-label={`Remove ${item.name || 'signature item'}`}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="add-item-btn" onClick={addSigItem}>
              + Add Signature Item
            </button>
          </section>

          {/* Special Abilities */}
          <section className="edit-section" aria-label="Edit special abilities">
            <h2 className="edit-section-title">Special Abilities</h2>
            {specialAbilities.map((ab, i) => (
              <div key={i} className="edit-ability-row">
                <input
                  className="edit-input"
                  value={ab.name}
                  onChange={(e) => updateAbility(i, { ...ab, name: e.target.value })}
                  onBlur={onBlurSave}
                  placeholder="Ability name"
                  aria-label={`Ability ${i + 1} name`}
                />
                <textarea
                  className="edit-textarea"
                  value={ab.effect}
                  onChange={(e) => updateAbility(i, { ...ab, effect: e.target.value })}
                  onBlur={onBlurSave}
                  placeholder="Effect description"
                  rows={2}
                  aria-label={`Ability ${i + 1} effect`}
                />
                <button
                  type="button"
                  className="item-remove-btn"
                  onClick={() => removeAbility(i)}
                  aria-label={`Remove ${ab.name || 'ability'}`}
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="add-item-btn" onClick={addAbility}>
              + Add Ability
            </button>
          </section>

          {/* Custom Tracks */}
          {customTracks.length > 0 && (
            <section className="edit-section" aria-label="Edit custom tracks">
              <h2 className="edit-section-title">Custom Tracks</h2>
              {customTracks.map((track, i) => (
                <div key={i} className="edit-track-row">
                  <span className="edit-track-name">{track.name}</span>
                  <div className="edit-track-controls">
                    <button
                      type="button"
                      className="stat-btn"
                      onClick={() => updateTrackValue(i, -1)}
                      disabled={track.current <= track.min}
                      aria-label={`Decrease ${track.name} from ${track.current}`}
                    >
                      −
                    </button>
                    <span className="edit-track-value">{track.current} / {track.max}</span>
                    <button
                      type="button"
                      className="stat-btn"
                      onClick={() => updateTrackValue(i, 1)}
                      disabled={track.current >= track.max}
                      aria-label={`Increase ${track.name} from ${track.current}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>

      {/* Bottom sections */}

      {/* Portrait */}
      <section className="edit-section sheet-section-full" aria-label="Change portrait">
        <h2 className="edit-section-title">Portrait</h2>
        <PortraitUpload
          onPortraitChange={(url) => {
            onPortraitChange(url);
          }}
          currentUrl={character.portraitUrl}
        />
      </section>

      {/* Bottom textareas */}
      <div className="sheet-edit-bottom">
        <section className="edit-section" aria-label="Edit backstory">
          <h2 className="edit-section-title">Backstory</h2>
          <textarea
            className="edit-textarea edit-textarea-lg"
            value={backstory}
            onChange={(e) => updateTextField('backstory', e.target.value)}
            onBlur={onBlurSave}
            placeholder="Character backstory…"
            rows={4}
            aria-label="Backstory"
          />
        </section>
        <section className="edit-section" aria-label="Edit player notes">
          <h2 className="edit-section-title">Notes</h2>
          <textarea
            className="edit-textarea edit-textarea-lg"
            value={notes}
            onChange={(e) => updateTextField('notes', e.target.value)}
            onBlur={onBlurSave}
            placeholder="Player notes…"
            rows={3}
            aria-label="Player notes"
          />
        </section>
        {isGM && (
          <section className="edit-section edit-section-gm" aria-label="Edit GM campaign notes">
            <h2 className="edit-section-title">Campaign Notes (GM Only)</h2>
            <textarea
              className="edit-textarea edit-textarea-lg"
              value={campaignNotes}
              onChange={(e) => updateTextField('campaignNotes', e.target.value)}
              onBlur={onBlurSave}
              placeholder="GM-only campaign notes…"
              rows={3}
              aria-label="GM campaign notes"
            />
          </section>
        )}
      </div>
    </article>
  );
}

// -----------------------------------------------------------------------------
// TagInput — inline add for tags
// -----------------------------------------------------------------------------

function TagInput({ onAdd, placeholder }: { onAdd: (value: string) => void; placeholder: string }) {
  const [value, setValue] = useState('');

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };

  return (
    <div className="tag-input-row">
      <input
        className="edit-input tag-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="button" className="tag-add-btn" onClick={handleAdd}>
        + Add
      </button>
    </div>
  );
}
