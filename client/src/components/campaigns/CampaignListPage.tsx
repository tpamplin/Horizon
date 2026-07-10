// =============================================================================
// Horizon — Campaign List Page
// =============================================================================
// Protected page showing all campaigns the user belongs to. Fetches from
// the API on mount, renders CampaignCard components, and supports creating
// new campaigns via the CreateCampaignModal.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useCampaignStore } from '../../stores/campaignStore.js';
import { CreateCampaignModal } from './CreateCampaignModal.js';
import { CampaignCard } from './CampaignCard.js';
import { JoinCampaign } from './JoinCampaign.js';
import type { Campaign } from 'shared';
import './CampaignListPage.css';

export function CampaignListPage() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const setCampaigns = useCampaignStore((s) => s.setCampaigns);
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign);
  const removeCampaign = useCampaignStore((s) => s.removeCampaign);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  // Fetch campaigns on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchCampaigns() {
      try {
        setLoading(true);
        setError(null);
        const data = await api.get<Campaign[]>('/api/campaigns');
        if (!cancelled) {
          setCampaigns(data);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to load campaigns.';
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCampaigns();

    return () => {
      cancelled = true;
    };
  }, [setCampaigns]);

  // Enter a campaign
  const handleEnter = useCallback(
    (campaignId: string) => {
      setActiveCampaign(campaignId);
      navigate(`/campaigns/${campaignId}`);
    },
    [navigate, setActiveCampaign],
  );

  const handleLeave = useCallback(
    (campaignId: string) => {
      removeCampaign(campaignId);
    },
    [removeCampaign],
  );

  const handleOpenModal = useCallback(() => setModalOpen(true), []);
  const handleCloseModal = useCallback(() => setModalOpen(false), []);
  const handleToggleJoin = useCallback(() => setJoinOpen((prev) => !prev), []);

  // Determine if user is GM for a given campaign
  const isGM = useCallback(
    (campaign: Campaign) => campaign.gmUserId === userId,
    [userId],
  );

  // ------- Render -------

  return (
    <div className="campaign-list-page">
      <header className="campaign-list-header">
        <div className="campaign-list-header-left">
          <Link to="/" className="back-link" aria-label="Back to home">← Home</Link>
          <h1>My Campaigns</h1>
        </div>
        <div className="campaign-list-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleToggleJoin}
            aria-expanded={joinOpen}
          >
            {joinOpen ? '− Join Campaign' : '+ Join Campaign'}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleOpenModal}>
            + New Campaign
          </button>
        </div>
      </header>

      {joinOpen && <JoinCampaign />}

      {loading ? (
        <div className="campaign-list-status" role="status" aria-label="Loading campaigns">
          <div className="spinner" />
          <p>Loading your campaigns…</p>
        </div>
      ) : error ? (
        <div className="campaign-list-status campaign-list-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="campaign-list-empty" aria-live="polite">
          <p>No campaigns yet — create one to get started!</p>
          <button type="button" className="btn btn-primary" onClick={handleOpenModal}>
            Create Your First Campaign
          </button>
        </div>
      ) : (
        <div className="campaign-list-grid">
          {campaigns.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              isGM={isGM(c)}
              onEnter={handleEnter}
              onLeave={handleLeave}
            />
          ))}
        </div>
      )}

      <CreateCampaignModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
