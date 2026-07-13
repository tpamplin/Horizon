// =============================================================================
// Horizon — SheetEdit Component
// =============================================================================
// Editable character sheet. Receives a Character and renders every sheet
// section with form controls. Changes save on blur with a debounced PUT.
// =============================================================================

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { STAT_KEYS, getStatDef, formatStatValue, parseStatValue, DIE_RATINGS } from 'shared';
import type {
  Character,
  SheetData,
  StatKey,
  DieRating,
  SignatureItem,
  SpecialAbility,
  TrackModifier,
  CreateSignatureItemRequest,
  CreateAbilityRequest,
  AbilityTemplate,
  ItemModifier,
} from 'shared';
import type { SaveState } from '../../stores/characterStore.js';
import type { SignatureItemTemplate } from 'shared';
import { api } from '../../api/client.js';
import { PortraitUpload } from './PortraitUpload.js';
import { PickFromAbilityLibrary } from './PickFromAbilityLibrary.js';
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

const SAVE_DEBOUNCE_MS = 300;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Clamp a numeric stat between 0 and 10. */
function clampStat(value: number): number {
  return Math.min(10, Math.max(0, value));
}

// -----------------------------------------------------------------------------
// PickFromLibrary — modal to select items from template library
// -----------------------------------------------------------------------------

function PickFromLibrary({ onPick }: { onPick: (template: SignatureItemTemplate) => void }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<SignatureItemTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const close = useCallback(() => {
    setOpen(false);
    // Return focus to trigger
    triggerRef.current?.focus();
  }, []);

  const openPicker = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<SignatureItemTemplate[]>('/api/items/templates');
      setTemplates(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load item templates.';
      setError(message);
      console.error('PickFromLibrary:', message);
    }
    finally { setLoading(false); }
  };

  // Focus trap + Escape handler
  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
    if (!modal) return;

    // Focus first focusable element after render
    const timer = setTimeout(() => {
      const first = modal.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector));
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, close, focusableSelector]);

  return (
    <>
      <button type="button" className="add-item-btn pick-lib-btn" onClick={openPicker} ref={triggerRef}>
        📋 Pick from Library
      </button>
      {open && (
        <div className="pick-library-overlay" role="dialog" aria-label="Pick signature item from library" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) close(); }} ref={modalRef}>
          <div className="pick-library-modal">
            <h2>Pick from Library</h2>
            {loading && <p className="loading-msg">Loading…</p>}
            {error && <p className="pick-library-error" role="alert">{error}</p>}
            {!loading && !error && (
            <div className="pick-library-grid">
              {templates.map(t => (
                <div key={t.id} className="pick-item-card" onClick={() => { onPick(t); close(); }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t); close(); } }}>
                  <h4>{t.name}</h4>
                  <p>{t.description.slice(0, 80)}{t.description.length > 80 ? '…' : ''}</p>
                  {t.category && <span className="tmpl-badge">{t.category}</span>}
                </div>
              ))}
            </div>
            )}
            <button className="pick-close" onClick={close}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// StatModAddMenu — dropdown to add stat modifier to a track level
// -----------------------------------------------------------------------------

function StatModAddMenu({
  existingStatKeys,
  onAdd,
}: {
  existingStatKeys: string[];
  onAdd: (statKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const available = STAT_KEYS.filter((k) => !existingStatKeys.includes(k));

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        wrapperRef.current?.querySelector<HTMLElement>('button')?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (available.length === 0) return null;

  return (
    <div className="stat-mod-add-wrapper" ref={wrapperRef}>
      <button type="button" className="add-item-btn add-stat-mod-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox">
        + Add Stat Modifier
      </button>
      {open && (
        <div className="stat-mod-add-menu" role="listbox" aria-label="Available stats">
          {available.map((key) => {
            const def = getStatDef(key);
            return (
              <button
                key={key}
                type="button"
                className="stat-mod-add-option"
                role="option"
                onClick={() => { onAdd(key); setOpen(false); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onAdd(key);
                    setOpen(false);
                  }
                }}
              >
                {def?.name ?? key}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SheetEdit({ character, saveState, isGM, onSave, onPortraitChange, onDone }: SheetEditProps) {
  const [sheetData, setSheetData] = useState<SheetData>(
    () => structuredClone(character.sheetData) as SheetData,
  );
  const [saveMsg, setSaveMsg] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardModalRef = useRef<HTMLDivElement>(null);

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

  // Focus trap for discard confirmation modal
  useEffect(() => {
    if (!showDiscardModal) return;
    const modal = discardModalRef.current;
    if (!modal) return;
    const focusableSelector = 'button:not([disabled])';
    const timer = setTimeout(() => {
      const first = modal.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDiscardModal(false);
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector));
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDiscardModal]);

  // Mark dirty helper — call on any field change (uses functional update to avoid stale closure)
  const markDirty = useCallback(() => {
    setIsDirty((prev) => prev ? prev : true);
  }, []);

  // Track which dice are in conflict (assigned to more than one stat)
  const dieConflicts = useMemo(() => {
    const counts = new Map<DieRating, number>();
    for (const k of STAT_KEYS) {
      const p = parseStatValue(sheetData.stats[k]);
      if (p.format === 'die' && p.die) {
        counts.set(p.die, (counts.get(p.die) ?? 0) + 1);
      }
    }
    const conflicts = new Set<DieRating>();
    for (const [die, count] of counts) {
      if (count > 1) conflicts.add(die);
    }
    return conflicts;
  }, [sheetData.stats]);

  // Explicit save: flush debounce, save immediately, return to view.
  // Blocked when die conflicts exist.
  const handleSave = useCallback(() => {
    if (dieConflicts.size > 0) {
      setSaveMsg('Resolve duplicate dice before saving');
      return;
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    setIsDirty(false);
    setSaveMsg('Saved');
    onSave(sheetData);
    // Brief delay so user sees "Saved" before returning to view
    setTimeout(() => onDone(), 400);
  }, [sheetData, onSave, onDone, dieConflicts]);

  // Cancel: show discard modal if dirty, else return immediately
  const handleCancel = useCallback(() => {
    if (isDirty) {
      setShowDiscardModal(true);
    } else {
      onDone();
    }
  }, [isDirty, onDone]);

  // Debounced save — also marks dirty. Skips save when die conflicts exist.
  const scheduleSave = useCallback(
    (updated: SheetData) => {
      markDirty();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        // Check conflicts on the latest sheetData at save time
        const conflicts = new Set<DieRating>();
        const counts = new Map<DieRating, number>();
        for (const k of STAT_KEYS) {
          const p = parseStatValue(updated.stats[k]);
          if (p.format === 'die' && p.die) {
            counts.set(p.die, (counts.get(p.die) ?? 0) + 1);
          }
        }
        for (const [die, count] of counts) {
          if (count > 1) conflicts.add(die);
        }
        if (conflicts.size > 0) {
          setSaveMsg('Duplicate dice — resolve before saving');
          saveTimerRef.current = null;
          return;
        }
        onSave(updated);
        saveTimerRef.current = null;
      }, SAVE_DEBOUNCE_MS);
    },
    [onSave, markDirty],
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
    markDirty();
    scheduleSave(updated);
  };

  // Change stat die rating — allow duplicates locally, block save on conflict
  const changeStatDie = (key: StatKey, newDie: DieRating) => {
    const updated: SheetData = {
      ...sheetData,
      stats: { ...sheetData.stats, [key]: newDie },
    };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Collect attribute modifiers from signature items and special abilities
  const itemModifiers = useMemo(() => {
    const mods: ItemModifier[] = [];
    for (const item of sheetData.signatureItems) {
      if (item.structuredModifiers) {
        for (const m of item.structuredModifiers) {
          if (m.target === 'attribute') mods.push(m);
        }
      }
    }
    return mods;
  }, [sheetData.signatureItems]);

  // Tag list helpers (traits/conditions still use plain strings)

  // Rich strength/flaw helpers

  /** Normalize legacy string entries to { name, description } objects. */
  const normalizeRichEntries = (field: 'strengths' | 'flaws'): { name: string; description: string }[] => {
    return (sheetData[field] as (string | { name: string; description: string })[]).map((entry) =>
      typeof entry === 'string' ? { name: entry, description: '' } : entry,
    );
  };

  const addRichEntry = (field: 'strengths' | 'flaws') => {
    const items = normalizeRichEntries(field);
    const updated: SheetData = {
      ...sheetData,
      [field]: [...items, { name: '', description: '' }],
    };
    markDirty();
    setSheetData(updated);
  };

  const updateRichEntry = (field: 'strengths' | 'flaws', index: number, entry: { name: string; description: string }) => {
    const items = normalizeRichEntries(field);
    items[index] = entry;
    const updated: SheetData = { ...sheetData, [field]: items };
    setSheetData(updated);
    scheduleSave(updated);
  };

  const removeRichEntry = (field: 'strengths' | 'flaws', index: number) => {
    const items = normalizeRichEntries(field);
    const updated: SheetData = {
      ...sheetData,
      [field]: items.filter((_, i) => i !== index),
    };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Signature items
  const [showCreateItemModal, setShowCreateItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemMods, setNewItemMods] = useState('');
  const [newItemRules, setNewItemRules] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [creatingItem, setCreatingItem] = useState(false);

  const [showCreateAbilityModal, setShowCreateAbilityModal] = useState(false);
  const [newAbilityName, setNewAbilityName] = useState('');
  const [newAbilityEffect, setNewAbilityEffect] = useState('');
  const [newAbilityCategory, setNewAbilityCategory] = useState('');
  const [creatingAbility, setCreatingAbility] = useState(false);

  const handleCreateSignatureItem = async () => {
    if (!newItemName.trim()) return;
    setCreatingItem(true);
    try {
      const payload: CreateSignatureItemRequest = { name: newItemName.trim(), description: newItemDesc.trim() };
      if (newItemMods.trim()) payload.modifiers = newItemMods.trim();
      if (newItemRules.trim()) payload.rules = newItemRules.trim();
      if (newItemCategory.trim()) payload.category = newItemCategory.trim();
      const template = await api.post<SignatureItemTemplate>('/api/items/templates', payload);
      const updated: SheetData = {
        ...sheetData,
        signatureItems: [...sheetData.signatureItems, {
          name: template.name,
          description: template.description,
          modifiers: template.modifiers,
          rules: template.rules,
          templateId: template.id,
        }],
      };
      markDirty();
      setSheetData(updated);
      scheduleSave(updated);
      // Reset and close
      setNewItemName(''); setNewItemDesc(''); setNewItemMods(''); setNewItemRules(''); setNewItemCategory('');
      setShowCreateItemModal(false);
    } catch (err) {
      console.error('Create signature item:', err);
    } finally {
      setCreatingItem(false);
    }
  };

  const handleCreateAbility = async () => {
    if (!newAbilityName.trim()) return;
    setCreatingAbility(true);
    try {
      const payload: CreateAbilityRequest = { name: newAbilityName.trim(), effect: newAbilityEffect.trim() };
      if (newAbilityCategory.trim()) payload.category = newAbilityCategory.trim();
      const template = await api.post<AbilityTemplate>('/api/abilities/templates', payload);
      const updated: SheetData = {
        ...sheetData,
        specialAbilities: [...sheetData.specialAbilities, {
          name: template.name,
          effect: template.effect,
          templateId: template.id,
        }],
      };
      markDirty();
      setSheetData(updated);
      scheduleSave(updated);
      setNewAbilityName(''); setNewAbilityEffect(''); setNewAbilityCategory('');
      setShowCreateAbilityModal(false);
    } catch (err) {
      console.error('Create ability:', err);
    } finally {
      setCreatingAbility(false);
    }
  };

  const updateSigItem = (index: number, item: SignatureItem) => {
    const items = [...sheetData.signatureItems];
    items[index] = item;
    setSheetData({ ...sheetData, signatureItems: items });
    scheduleSave({ ...sheetData, signatureItems: items });
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

  const addTrackLevel = (trackIndex: number) => {
    const tracks = [...sheetData.customTracks];
    const track = { ...tracks[trackIndex]! };
    const levels = [...(track.levels ?? [])];
    const nextLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.atLevel)) + 1 : 0;
    levels.push({ atLevel: nextLevel, description: '' });
    track.levels = levels;
    tracks[trackIndex] = track;
    const updated: SheetData = { ...sheetData, customTracks: tracks };
    setSheetData(updated);
    scheduleSave(updated);
  };

  const updateTrackLevel = (trackIndex: number, levelIndex: number, level: TrackModifier) => {
    const tracks = [...sheetData.customTracks];
    const track = { ...tracks[trackIndex]! };
    const levels = [...(track.levels ?? [])];
    levels[levelIndex] = level;
    track.levels = levels;
    tracks[trackIndex] = track;
    const updated: SheetData = { ...sheetData, customTracks: tracks };
    setSheetData(updated);
    scheduleSave(updated);
  };

  const removeTrackLevel = (trackIndex: number, levelIndex: number) => {
    const tracks = [...sheetData.customTracks];
    const track = { ...tracks[trackIndex]! };
    const levels = [...(track.levels ?? [])];
    track.levels = levels.filter((_, i) => i !== levelIndex);
    tracks[trackIndex] = track;
    const updated: SheetData = { ...sheetData, customTracks: tracks };
    setSheetData(updated);
    scheduleSave(updated);
  };

  const updateTrackLevelStatMod = (
    trackIndex: number, levelIndex: number, statKey: string, value: number | undefined,
  ) => {
    const tracks = [...sheetData.customTracks];
    const track = { ...tracks[trackIndex]! };
    const levels = [...(track.levels ?? [])];
    const level = { ...levels[levelIndex]! };
    const mods = { ...(level.statModifiers ?? {}) };
    if (value === undefined || isNaN(value)) {
      delete mods[statKey];
    } else {
      mods[statKey] = value;
    }
    level.statModifiers = Object.keys(mods).length > 0 ? mods : undefined;
    levels[levelIndex] = level;
    track.levels = levels;
    tracks[trackIndex] = track;
    const updated: SheetData = { ...sheetData, customTracks: tracks };
    setSheetData(updated);
    scheduleSave(updated);
  };

  // Blur handler for text fields
  const onBlurSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    onSave(sheetData);
  }, [sheetData, onSave]);

  // Text field update
  const updateTextField = useCallback(
    (field: 'backstory' | 'campaignNotes', value: string) => {
      const updated: SheetData = { ...sheetData, [field]: value };
      markDirty();
      setSheetData(updated);
    },
    [sheetData, markDirty],
  );

  const { stats, signatureItems, specialAbilities, customTracks, backstory, campaignNotes } = sheetData;

  return (
    <article className="sheet-edit" ref={editRef} aria-label={`Editing character sheet for ${character.name}`}>
      {/* Header */}
      <header className="sheet-edit-header">
        <PortraitUpload
          onPortraitChange={(url) => {
            onPortraitChange(url);
          }}
          currentUrl={character.portraitUrl}
        />
        <div className="sheet-edit-header-text">
          <h1 className="sheet-edit-name">{character.name}</h1>
          <p className="sheet-edit-archetype">{character.archetype}</p>
        </div>
        <div className="sheet-edit-actions">
          <span className={`save-indicator save-${saveState}`} aria-live="polite">
            {saveMsg}
          </span>
          <button
            type="button"
            className="save-btn"
            onClick={handleSave}
            aria-label="Save character sheet and return to view"
          >
            Save
          </button>
          <button
            type="button"
            className="cancel-btn"
            onClick={handleCancel}
            aria-label={isDirty ? 'Cancel editing — unsaved changes exist' : 'Cancel editing'}
          >
            Cancel
          </button>
        </div>
      </header>

      {/* Discard confirmation modal */}
      {showDiscardModal && (
        <div className="discard-overlay" role="alertdialog" aria-label="Discard unsaved changes" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowDiscardModal(false); }} ref={discardModalRef}>
          <div className="discard-modal">
            <h2>Discard unsaved changes?</h2>
            <p>You have unsaved edits. If you discard, all changes will be lost.</p>
            <div className="discard-modal-actions">
              <button
                type="button"
                className="discard-discard-btn"
                onClick={() => { setShowDiscardModal(false); onDone(); }}
              >
                Discard
              </button>
              <button
                type="button"
                className="discard-keep-btn"
                onClick={() => setShowDiscardModal(false)}
                autoFocus
              >
                Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attributes — horizontal row */}
      <section className="edit-section edit-attrs-row" aria-label="Edit character attributes">
        <h2 className="edit-section-title">Attributes</h2>
        <div className="edit-attrs-grid">
          {STAT_KEYS.map((key: StatKey) => {
              const def = getStatDef(key);
              const value = stats[key];
              const parsed = parseStatValue(value);
              const isDie = parsed.format === 'die';
              const numVal = typeof value === 'number' ? value : 0;
              const dieVal = (parsed.format === 'die' && parsed.die) ? parsed.die : def?.defaultDie ?? 'D10';
              // Computed modifier from items only (no manual input)
              const computedMod = itemModifiers
                .filter(m => m.key === key)
                .reduce((sum, m) => sum + m.value, 0);
              const display = formatStatValue(value, computedMod || undefined);
              return (
                <div key={key} className="edit-stat-row">
                  <label className="edit-stat-label" id={`edit-stat-${key}`}>
                    {def?.name ?? key}
                  </label>
                  <div className="edit-stat-controls">
                    {isDie ? (
                      <>
                        <select
                          className={`edit-stat-die-select${dieConflicts.has(dieVal) ? ' die-conflict' : ''}`}
                          value={dieVal}
                          onChange={(e) => changeStatDie(key, e.target.value as DieRating)}
                          aria-label={`Die rating for ${def?.name ?? key}`}
                          aria-invalid={dieConflicts.has(dieVal) ? 'true' : undefined}
                        >
                          {DIE_RATINGS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        {dieConflicts.has(dieVal) && (
                          <span className="die-conflict-warning" role="alert">
                            ⚠ Duplicate
                          </span>
                        )}
                        {computedMod !== 0 && (
                          <span className="edit-stat-computed-mod">
                            {computedMod > 0 ? '+' : ''}{computedMod}
                          </span>
                        )}
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
          </div>
        </section>

      {/* Two columns: Items (left) | Abilities (right) */}
      <div className="sheet-edit-body">
        <div className="sheet-edit-body-columns">
        <div className="sheet-edit-col">
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
            <button type="button" className="add-item-btn" onClick={() => setShowCreateItemModal(true)}>
              + Add Signature Item
            </button>
            <PickFromLibrary
              onPick={(template) => {
                const updated: SheetData = {
                  ...sheetData,
                  signatureItems: [...sheetData.signatureItems, {
                    name: template.name,
                    description: template.description,
                    modifiers: template.modifiers,
                    rules: template.rules,
                    templateId: template.id,
                  }],
                };
                setSheetData(updated);
                scheduleSave(updated);
              }}
            />
          </section>
        </div>
        <div className="sheet-edit-col">
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
            <button type="button" className="add-item-btn" onClick={() => setShowCreateAbilityModal(true)}>
              + Add Ability
            </button>
            <PickFromAbilityLibrary
              onPick={(template) => {
                const updated: SheetData = {
                  ...sheetData,
                  specialAbilities: [...sheetData.specialAbilities, {
                    name: template.name,
                    effect: template.effect,
                    templateId: template.id,
                  }],
                };
                setSheetData(updated);
                scheduleSave(updated);
              }}
            />
          </section>
        </div>
      </div>
      </div>

      {/* Strengths & Flaws (full width, two internal columns) */}
      <section className="edit-section sheet-section-full" aria-label="Edit strengths and flaws">
        <h2 className="edit-section-title">Strengths &amp; Flaws</h2>
        <div className="strength-flaw-grid">
          {(['strengths', 'flaws'] as const).map((field) => {
            const items = normalizeRichEntries(field);
            const label = field === 'strengths' ? 'Strengths' : 'Flaws';
            return (
              <div key={field}>
                <h3 className="subsection-title">{label}</h3>
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
              </div>
            );
          })}
        </div>
      </section>

      {/* Special Mechanics (placeholder) */}
      <section className="edit-section" aria-label="Special mechanics">
        <h2 className="edit-section-title">Special Mechanics</h2>
        <p className="mechanics-placeholder">No special mechanics active. The GM can enable mechanics like Wild Magic for this campaign.</p>
      </section>

      {/* Custom Tracks */}
      {customTracks.length > 0 && (
        <section className="edit-section" aria-label="Edit custom tracks">
          <h2 className="edit-section-title">Custom Tracks</h2>
              {customTracks.map((track, i) => (
                <div key={i} className="edit-track-row">
                  <div className="edit-track-header">
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

                  {/* Track Level Editing */}
                  <div className="edit-track-levels">
                    {(track.levels ?? []).map((level, li) => (
                      <div key={li} className="edit-track-level-item">
                        <div className="edit-track-level-header">
                          <label className="edit-track-level-label">
                            Level
                            <input
                              type="number"
                              className="edit-input edit-level-num"
                              value={level.atLevel}
                              onChange={(e) => updateTrackLevel(i, li, {
                                ...level,
                                atLevel: Math.max(0, Number(e.target.value) || 0),
                              })}
                              onBlur={onBlurSave}
                              min={0}
                              aria-label={`Level ${li + 1} threshold for ${track.name}`}
                            />
                          </label>
                          <button
                            type="button"
                            className="item-remove-btn"
                            onClick={() => removeTrackLevel(i, li)}
                            aria-label={`Remove level ${level.atLevel} from ${track.name}`}
                          >
                            ×
                          </button>
                        </div>
                        <textarea
                          className="edit-textarea edit-textarea-sm"
                          value={level.description}
                          onChange={(e) => updateTrackLevel(i, li, {
                            ...level,
                            description: e.target.value,
                          })}
                          onBlur={onBlurSave}
                          placeholder="Level description…"
                          rows={2}
                          aria-label={`Level ${level.atLevel} description for ${track.name}`}
                        />

                        {/* Stat Modifiers for this level */}
                        <div className="edit-level-stat-mods">
                          <span className="edit-level-stat-mods-label">Stat modifiers:</span>
                          {Object.entries(level.statModifiers ?? {}).map(([statKey, val]) => (
                            <div key={statKey} className="edit-level-stat-mod-row">
                              <label className="edit-level-stat-mod-key">
                                {getStatDef(statKey as StatKey)?.name ?? statKey}
                              </label>
                              <input
                                type="number"
                                className="edit-input edit-stat-mod-input"
                                value={val}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const num = raw === '' || raw === '-' ? undefined : parseInt(raw, 10);
                                  updateTrackLevelStatMod(i, li, statKey, num as number | undefined);
                                }}
                                onBlur={onBlurSave}
                                placeholder="0"
                                aria-label={`${getStatDef(statKey as StatKey)?.name ?? statKey} modifier at level ${level.atLevel}`}
                              />
                              <button
                                type="button"
                                className="tag-remove-btn"
                                onClick={() => updateTrackLevelStatMod(i, li, statKey, undefined)}
                                aria-label={`Remove ${statKey} modifier from level ${level.atLevel}`}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <StatModAddMenu
                            existingStatKeys={Object.keys(level.statModifiers ?? {})}
                            onAdd={(statKey) => updateTrackLevelStatMod(i, li, statKey, 0)}
                          />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="add-item-btn"
                      onClick={() => addTrackLevel(i)}
                    >
                      + Add Level
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

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

      {/* Create Signature Item Modal */}
      {showCreateItemModal && (
        <div className="pick-library-overlay" role="dialog" aria-label="Create signature item" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateItemModal(false); }}>
          <div className="pick-library-modal">
            <h2>Create Signature Item</h2>
            <label>
              Name
              <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Item name" autoFocus />
            </label>
            <label>
              Description
              <textarea value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} placeholder="Description" rows={2} />
            </label>
            <label>
              Modifiers
              <input value={newItemMods} onChange={(e) => setNewItemMods(e.target.value)} placeholder="+2 influence" />
            </label>
            <label>
              Rules
              <input value={newItemRules} onChange={(e) => setNewItemRules(e.target.value)} placeholder="Rules" />
            </label>
            <label>
              Category
              <input value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} placeholder="weapon" />
            </label>
            <div className="create-actions">
              <button onClick={handleCreateSignatureItem} disabled={creatingItem || !newItemName.trim()}>
                {creatingItem ? 'Saving…' : 'Save to Library & Add'}
              </button>
              <button className="btn-cancel" onClick={() => setShowCreateItemModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Ability Modal */}
      {showCreateAbilityModal && (
        <div className="pick-library-overlay" role="dialog" aria-label="Create special ability" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateAbilityModal(false); }}>
          <div className="pick-library-modal">
            <h2>Create Special Ability</h2>
            <label>
              Name
              <input value={newAbilityName} onChange={(e) => setNewAbilityName(e.target.value)} placeholder="Ability name" autoFocus />
            </label>
            <label>
              Effect
              <textarea value={newAbilityEffect} onChange={(e) => setNewAbilityEffect(e.target.value)} placeholder="Effect description" rows={3} />
            </label>
            <label>
              Category
              <input value={newAbilityCategory} onChange={(e) => setNewAbilityCategory(e.target.value)} placeholder="combat" />
            </label>
            <div className="create-actions">
              <button onClick={handleCreateAbility} disabled={creatingAbility || !newAbilityName.trim()}>
                {creatingAbility ? 'Saving…' : 'Save to Library & Add'}
              </button>
              <button className="btn-cancel" onClick={() => setShowCreateAbilityModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

// -----------------------------------------------------------------------------
// Create modals rendered inline in the JSX above
// -----------------------------------------------------------------------------

