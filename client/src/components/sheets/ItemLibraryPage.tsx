// =============================================================================
// Horizon — Item Template Library Page
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import type { SignatureItemTemplate, CreateSignatureItemRequest } from 'shared';
import './ItemLibraryPage.css';

export function ItemLibraryPage() {
  const [templates, setTemplates] = useState<SignatureItemTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [modifiers, setModifiers] = useState('');
  const [rules, setRules] = useState('');
  const [category, setCategory] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<SignatureItemTemplate[]>('/api/items/templates');
      setTemplates(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const payload: CreateSignatureItemRequest = { name: name.trim(), description: desc.trim() };
    if (modifiers.trim()) payload.modifiers = modifiers.trim();
    if (rules.trim()) payload.rules = rules.trim();
    if (category.trim()) payload.category = category.trim();
    try {
      await api.post<SignatureItemTemplate>('/api/items/templates', payload);
      setCreateOpen(false); setName(''); setDesc(''); setModifiers(''); setRules(''); setCategory('');
      fetchTemplates();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create template.';
      setError(message);
      console.error('ItemLibraryPage create:', message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/items/templates/${id}`);
      fetchTemplates();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete template.';
      setError(message);
      console.error('ItemLibraryPage delete:', message);
    }
  };

  return (
    <div className="item-library">
      <header className="item-library-header">
        <h1>Item Templates</h1>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>+ New Template</button>
      </header>

      {error && <p className="error-msg" role="alert">{error}</p>}

      {createOpen && (
        <div className="create-modal" role="dialog" aria-label="Create item template">
          <h2>Create Item Template</h2>
          <label>Name <input value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
          <label>Description <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></label>
          <label>Modifiers <input value={modifiers} onChange={e => setModifiers(e.target.value)} placeholder="+2 influence" /></label>
          <label>Rules <input value={rules} onChange={e => setRules(e.target.value)} /></label>
          <label>Category <input value={category} onChange={e => setCategory(e.target.value)} placeholder="weapon" /></label>
          <div className="create-actions">
            <button onClick={handleCreate} disabled={!name.trim()}>Create</button>
            <button className="btn-cancel" onClick={() => setCreateOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading && <p className="loading-msg">Loading…</p>}

      <div className="item-library-grid">
        {templates.map(t => (
          <div key={t.id} className="item-template-card">
            <h3>{t.name}</h3>
            <p className="tmpl-desc">{t.description}</p>
            {t.modifiers && <p className="tmpl-meta"><strong>Modifiers:</strong> {t.modifiers}</p>}
            {t.rules && <p className="tmpl-meta"><strong>Rules:</strong> {t.rules}</p>}
            {t.category && <span className="tmpl-badge">{t.category}</span>}
            <button className="btn-delete" onClick={() => handleDelete(t.id)}>Delete</button>
          </div>
        ))}
        {!loading && templates.length === 0 && <p className="empty-msg">No templates yet.</p>}
      </div>
    </div>
  );
}
