// =============================================================================
// Horizon — Join Campaign Form
// =============================================================================
// Inline form for joining a campaign by invite code. Embedded in the
// CampaignListPage header area. On success, redirects to the campaign.
// =============================================================================

import { useState, useRef, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useCampaignStore } from '../../stores/campaignStore.js';
import type { Campaign } from 'shared';
import './JoinCampaign.css';

export function JoinCampaign() {
  const navigate = useNavigate();
  const addCampaign = useCampaignStore((s) => s.addCampaign);
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!code.trim()) {
        setError('Please enter an invite code.');
        inputRef.current?.focus();
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const campaign = await api.post<Campaign>('/api/campaigns/join', {
          inviteCode: code.trim(),
        });
        addCampaign(campaign);
        navigate(`/campaigns/${campaign.id}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to join campaign.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [code, addCampaign, navigate],
  );

  return (
    <form className="join-campaign" onSubmit={handleSubmit} noValidate>
      <label htmlFor="join-invite-code" className="join-label">
        Join Campaign
      </label>
      <div className="join-row">
        <input
          ref={inputRef}
          id="join-invite-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter invite code…"
          maxLength={16}
          disabled={loading}
          aria-describedby={error ? 'join-error' : undefined}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || !code.trim()}
        >
          {loading ? 'Joining…' : 'Join'}
        </button>
      </div>
      {error && (
        <p id="join-error" className="join-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
