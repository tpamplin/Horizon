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
  const deleteCharacter = useCharacterStore((s) => s.deleteCharacter);
  const loading = useCharacterStore((s) => s.loading);
  const error = useCharacterStore((s) => s.error);

  useEffect(() => {
    fetchMyCharacters();
  }, [fetchMyCharacters]);

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

  return (
    <div className="char-library">
      <header className="char-library-header">
        <button className="sheet-back-btn" onClick={() => navigate('/')} aria-label="Back to Dashboard">
          ← Back to Dashboard
        </button>
        <h1>My Characters</h1>
        <button className="char-library-create-btn" onClick={() => navigate('/characters/new')}>
          + New Character
        </button>
      </header>

      {error && <p className="char-library-error" role="alert">{error}</p>}

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
