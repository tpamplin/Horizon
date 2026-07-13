// =============================================================================
// Horizon — New Character Page
// =============================================================================
// Renders an empty character sheet editor. On first save, creates the character
// via the API and navigates to the new character's view page.
// =============================================================================

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SheetEdit } from './SheetEdit.js';
import { useCharacterStore } from '../../stores/characterStore.js';
import type { Character, SheetData } from 'shared';

/** Blank character template for new character creation. */
const BLANK_CHARACTER: Character = {
  id: 'new',
  playerUserId: '',
  name: '',
  archetype: '',
  portraitUrl: null,
  sheetData: {
    stats: {
      cognition: '',
      force: '',
      reflex: '',
      conflict: '',
      influence: '',
      stability: '',
    },
    adversityTokens: 0,
    strengths: [],
    flaws: [],
    traits: [],
    inventory: [],
    signatureItems: [],
    specialAbilities: [],
    conditions: [],
    customTracks: [],
    backstory: '',
    notes: '',
    campaignNotes: '',
  },
  createdAt: new Date().toISOString(),
};

export function NewCharacterPage() {
  const navigate = useNavigate();
  const createCharacter = useCharacterStore((s) => s.createCharacter);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const handleSave = useCallback(
    async (sheetData: SheetData, name?: string, archetype?: string) => {
      const ch = await createCharacter(
        name || 'Unnamed',
        archetype || 'custom',
        sheetData,
      );
      setCreatedId(ch.id);
      navigate(`/characters/${ch.id}`, { replace: true });
    },
    [createCharacter, navigate],
  );

  const handleDone = useCallback(() => {
    if (createdId) {
      navigate(`/characters/${createdId}`, { replace: true });
    } else {
      navigate('/characters', { replace: true });
    }
  }, [createdId, navigate]);

  return (
    <SheetEdit
      character={BLANK_CHARACTER}
      saveState="idle"
      isGM={false}
      onSave={handleSave}
      onPortraitChange={() => {}}
      onDone={handleDone}
      isNew
    />
  );
}
