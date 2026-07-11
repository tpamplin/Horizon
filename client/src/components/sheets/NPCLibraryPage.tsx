// =============================================================================
// Horizon — NPC Library Page
// =============================================================================
// Displays the authenticated user's NPC library. Supports create, delete,
// and navigation to the NPC viewer.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNPCStore } from '../../stores/npcStore.js';
import type { NPC } from 'shared';
import './NPCLibraryPage.css';

export function NPCLibraryPage() {
  const navigate = useNavigate();
  const npcs = useNPCStore((s) => s.npcs);
  const fetchMyNPCs = useNPCStore((s) => s.fetchMyNPCs);
  const createNPC = useNPCStore((s) => s.createNPC);
  const deleteNPC = useNPCStore((s) => s.deleteNPC);
  const loading = useNPCStore((s) => s.loading);
  const error = useNPCStore((s) => s.error);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [archetype, setArchetype] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMyNPCs();
  }, [fetchMyNPCs]);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const npc = await createNPC(name.trim(), archetype.trim() || 'custom');
      setCreateOpen(false);
      setName('');
      setArchetype('');
      navigate(`/npcs/${npc.id}`);
    } catch {
      // Error handled by store
    } finally {
      setSubmitting(false);
    }
  }, [name, archetype, createNPC, navigate]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteNPC(id);
      } catch {
        // Error handled by store
      }
    },
    [deleteNPC],
  );

  const handleKeyCreate = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCreate();
    },
    [handleCreate],
  );

  return (
    <div className="npc-library">
      <header className="npc-library__header">
        <h1>My NPCs</h1>
        <button className="npc-library__create-btn" onClick={() => setCreateOpen(true)}>
          + New NPC
        </button>
      </header>

      {error && <p className="npc-library__error" role="alert">{error}</p>}

      {createOpen && (
        <div className="npc-library__create-modal" role="dialog" aria-label="Create NPC">
          <h2>Create NPC</h2>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyCreate}
              placeholder="NPC name"
              autoFocus
            />
          </label>
          <label>
            Archetype
            <input
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              onKeyDown={handleKeyCreate}
              placeholder="e.g. Guard, Merchant, Beast"
            />
          </label>
          <div className="npc-library__create-actions">
            <button onClick={handleCreate} disabled={submitting || !name.trim()}>
              {submitting ? 'Creating…' : 'Create'}
            </button>
            <button className="npc-library__cancel" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="npc-library__loading">Loading…</p>}

      {!loading && npcs.length === 0 && (
        <p className="npc-library__empty">No NPCs yet. Build your cast!</p>
      )}

      <div className="npc-library__grid">
        {npcs.map((n) => (
          <NPCCard
            key={n.id}
            npc={n}
            onClick={() => navigate(`/npcs/${n.id}`)}
            onDelete={() => handleDelete(n.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface NPCCardProps {
  npc: NPC;
  onClick: () => void;
  onDelete: () => void;
}

function NPCCard({ npc, onClick, onDelete }: NPCCardProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="npcard" onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }} tabIndex={0} role="button">
      {npc.portraitUrl ? (
        <img src={npc.portraitUrl} alt={npc.name} className="npcard__portrait" />
      ) : (
        <div className="npcard__portrait-placeholder">{npc.name[0]?.toUpperCase()}</div>
      )}
      <div className="npcard__info">
        <h3>{npc.name}</h3>
        <p className="npcard__archetype">{npc.archetype}</p>
      </div>
      <div className="npcard__actions">
        {confirming ? (
          <>
            <button
              className="npcard__delete-confirm"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              Delete
            </button>
            <button
              className="npcard__delete-cancel"
              onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className="npcard__delete"
            onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
            title="Delete NPC"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}
