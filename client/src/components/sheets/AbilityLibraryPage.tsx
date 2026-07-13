import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import type { AbilityTemplate, CreateAbilityRequest } from 'shared';
import './ItemLibraryPage.css';

export function AbilityLibraryPage() {
  const [templates, setTemplates] = useState<AbilityTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [effect, setEffect] = useState('');
  const [category, setCategory] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try { setTemplates(await api.get<AbilityTemplate[]>('/api/abilities/templates')); setError(null); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed to load.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const payload: CreateAbilityRequest = { name: name.trim(), effect: effect.trim() };
    if (category.trim()) payload.category = category.trim();
    try { await api.post<AbilityTemplate>('/api/abilities/templates', payload); setCreateOpen(false); setName(''); setEffect(''); setCategory(''); fetchTemplates(); }
    catch { /* handled */ }
  };

  const handleDelete = async (id: string) => { try { await api.delete(`/api/abilities/templates/${id}`); fetchTemplates(); } catch { /* handled */ } };

  return (
    <div className="item-library">
      <header className="item-library-header">
        <button className="sheet-back-btn" onClick={() => window.history.back()} aria-label="Back to previous page">
          ← Back
        </button>
        <h1>Ability Templates</h1>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>+ New Template</button>
      </header>
      {error && <p className="error-msg" role="alert">{error}</p>}
      {createOpen && (
        <div className="create-modal" role="dialog" aria-label="Create ability template">
          <h2>Create Ability Template</h2>
          <label>Name <input value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
          <label>Effect <textarea value={effect} onChange={e => setEffect(e.target.value)} rows={3} /></label>
          <label>Category <input value={category} onChange={e => setCategory(e.target.value)} placeholder="combat" /></label>
          <div className="create-actions"><button onClick={handleCreate} disabled={!name.trim()}>Create</button><button className="btn-cancel" onClick={() => setCreateOpen(false)}>Cancel</button></div>
        </div>
      )}
      {loading && <p className="loading-msg">Loading…</p>}
      <div className="item-library-grid">
        {templates.map(t => (
          <div key={t.id} className="item-template-card">
            <h3>{t.name}</h3>
            <p className="tmpl-desc">{t.effect.slice(0, 120)}{t.effect.length > 120 ? '…' : ''}</p>
            {t.category && <span className="tmpl-badge">{t.category}</span>}
            <button className="btn-delete" onClick={() => handleDelete(t.id)}>Delete</button>
          </div>
        ))}
        {!loading && templates.length === 0 && <p className="empty-msg">No ability templates yet.</p>}
      </div>
    </div>
  );
}
