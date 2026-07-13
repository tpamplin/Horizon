import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../../api/client.js';
import type { AbilityTemplate } from 'shared';

export function PickFromAbilityLibrary({ onPick }: { onPick: (template: AbilityTemplate) => void }) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<AbilityTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const openPicker = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AbilityTemplate[]>('/api/abilities/templates');
      setTemplates(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load ability templates.';
      setError(message);
      console.error('PickFromAbilityLibrary:', message);
    } finally {
      setLoading(false);
    }
  };

  // Focus trap + Escape handler
  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
    if (!modal) return;

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
      <button type="button" className="add-item-btn pick-lib-btn" onClick={openPicker} ref={triggerRef}>📋 Pick from Library</button>
      {open && (
        <div className="pick-library-overlay" role="dialog" aria-label="Pick ability from library" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) close(); }} ref={modalRef}>
          <div className="pick-library-modal">
            <h2>Pick Ability from Library</h2>
            {loading && <p className="loading-msg">Loading…</p>}
            {error && <p className="pick-library-error" role="alert">{error}</p>}
            {!loading && !error && (
            <div className="pick-library-grid">
              {templates.map(t => (
                <div key={t.id} className="pick-item-card" onClick={() => { onPick(t); close(); }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t); close(); } }}>
                  <h4>{t.name}</h4>
                  <p>{t.effect.slice(0, 80)}{t.effect.length > 80 ? '…' : ''}</p>
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
