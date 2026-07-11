// =============================================================================
// Horizon — Character Library Page
// =============================================================================
// Displays the authenticated user's character library. Supports create,
// delete, and navigation to the character sheet viewer.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCharacterStore } from '../../stores/characterStore.js';
import type { Character } from 'shared';
import './CharacterLibraryPage.css';

export function CharacterLibraryPage() {
  const navigate = useNavigate();
  const characters = useCharacterStore((s) => s.campaignCharacters);
  const fetchMyCharacters = useCharacterStore((s) => s.fetchMyCharacters);
  const createCharacter = useCharacterStore((s) => s.createCharacter);
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter);
  const loading = useCharacterStore((s) => s.loading);
  const error = useCharacterStore((s) => s.error);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [archetype, setArchetype] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMyCharacters();
  }, [fetchMyCharacters]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const ch = await createCharacter(name.trim(), archetype.trim() || 'custom');
      setCreateOpen(false);
      setName('');
      setArchetype('');
      navigate(`/characters/${ch.id}`);
    } catch {
      // Error handled by store
    } finally {
      setSubmitting(false);
    }
  }, [name, archetype, createCharacter, navigate]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteCharacter(id);
      } catch {
        // Error handled by store
      }
    },
    [deleteCharacter],
  );

  const handleKeyCreate = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCreate();
    },
    [handleCreate],
  );

  return (
    <div className="char-library">
      <header className="char-library-header">
        <h1>My Characters</h1>
        <button className="char-library-create-btn" onClick={() => setCreateOpen(true)}>
          + New Character
        </button>
      </header>

      {error && <p className="char-library-error" role="alert">{error}</p>}

      {createOpen && (
        <div className="char-library-create-modal" role="dialog" aria-label="Create character">
          <h2>Create Character</h2>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyCreate}
              placeholder="Character name"
              autoFocus
            />
          </label>
          <label>
            Archetype
            <input
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              onKeyDown={handleKeyCreate}
              placeholder="e.g. Warrior, Mystic, Rogue"
            />
          </label>
          <div className="char-library-create-actions">
            <button onClick={handleCreate} disabled={submitting || !name.trim()}>
              {submitting ? 'Creating…' : 'Create'}
            </button>
            <button className="char-library-cancel" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="char-library-loading">Loading…</p>}

      {!loading && characters.length === 0 && (
        <p className="char-library-empty">No characters yet. Create your first!</p>
      )}

      <div className="char-library-grid">
        {characters.map((ch) => (
          <CharacterCard
            key={ch.id}
            character={ch}
            onClick={() => navigate(`/characters/${ch.id}`)}
            onDelete={() => handleDelete(ch.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface CharacterCardProps {
  character: Character;
  onClick: () => void;
  onDelete: () => void;
}

function CharacterCard({ character, onClick, onDelete }: CharacterCardProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="char-card" onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }} tabIndex={0} role="button">
      {character.portraitUrl ? (
        <img src={character.portraitUrl} alt={character.name} className="char-card-portrait" />
      ) : (
        <div className="char-card-portrait-placeholder">{character.name[0]?.toUpperCase()}</div>
      )}
      <div className="char-card-info">
        <h3>{character.name}</h3>
        <p className="char-card-archetype">{character.archetype}</p>
      </div>
      <div className="char-card-actions">
        {confirming ? (
          <>
            <button
              className="char-card-delete-confirm"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              Delete
            </button>
            <button
              className="char-card-delete-cancel"
              onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className="char-card-delete"
            onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
            title="Delete character"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}
