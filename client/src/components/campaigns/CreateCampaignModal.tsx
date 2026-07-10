// =============================================================================
// Horizon — Create Campaign Modal
// =============================================================================
// Modal form for creating a new campaign. Shows the generated invite code
// on success. Uses the API client for the server request and campainStore
// for state management.
// =============================================================================

import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { api } from '../../api/client.js';
import { useCampaignStore } from '../../stores/campaignStore.js';
import type { Campaign } from 'shared';
import './CreateCampaignModal.css';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface CreateCampaignModalProps {
  /** Whether the modal is currently visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal (cancel, Escape, backdrop click). */
  onClose: () => void;
  /** Called after a campaign is successfully created, with the new Campaign object. */
  onCreated?: (campaign: Campaign) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CreateCampaignModal({ isOpen, onClose, onCreated }: CreateCampaignModalProps) {
  const addCampaign = useCampaignStore((s) => s.addCampaign);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCampaign, setCreatedCampaign] = useState<Campaign | null>(null);
  const [copied, setCopied] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setError(null);
      setCreatedCampaign(null);
      setCopied(false);
      // Save currently focused element to restore on close
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus the name input on open
      requestAnimationFrame(() => nameInputRef.current?.focus());
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isOpen]);

  // Trap focus within the modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'input, textarea, button, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    },
    [onClose],
  );

  // Submit handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Campaign name is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const campaign = await api.post<Campaign>('/api/campaigns', {
        name: name.trim(),
        description: description.trim() || undefined,
      });

      setCreatedCampaign(campaign);
      addCampaign(campaign);
      onCreated?.(campaign);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create campaign. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = useCallback(async () => {
    if (!createdCampaign) return;
    try {
      await navigator.clipboard.writeText(createdCampaign.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — user can still manually select + copy
    }
  }, [createdCampaign]);

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="modal-content"
        role="dialog"
        aria-labelledby="create-campaign-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {createdCampaign ? (
          /* Success State */
          <div className="modal-success">
            <h2 id="create-campaign-title" className="modal-title">
              Campaign Created!
            </h2>
            <p className="modal-subtitle">
              Share this invite code with your players so they can join:
            </p>
            <div className="invite-code-display" aria-live="polite">
              <code className="invite-code">{createdCampaign.inviteCode}</code>
            </div>
            <button
              type="button"
              className="btn btn-copy"
              onClick={handleCopy}
              disabled={copied}
              aria-label={copied ? 'Copied to clipboard' : 'Copy invite code to clipboard'}
            >
              {copied ? '✓ Copied!' : '📋 Copy Code'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
              autoFocus
            >
              Done
            </button>
          </div>
        ) : (
          /* Form State */
          <>
            <h2 id="create-campaign-title" className="modal-title">
              Create New Campaign
            </h2>

            {error && (
              <div className="modal-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-field">
                <label htmlFor="campaign-name">Campaign Name *</label>
                <input
                  ref={nameInputRef}
                  id="campaign-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='e.g. "The Hollow Creek Mystery"'
                  maxLength={100}
                  required
                  aria-describedby={error ? 'campaign-error' : undefined}
                  disabled={loading}
                />
              </div>

              <div className="form-field">
                <label htmlFor="campaign-description">Description (optional)</label>
                <textarea
                  id="campaign-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A short premise for your campaign..."
                  rows={3}
                  maxLength={500}
                  disabled={loading}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !name.trim()}
                >
                  {loading ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
