// =============================================================================
// Horizon — Campaign Card Component
// =============================================================================
// Displays a campaign as a clickable card with name, description preview,
// role badge (GM/Player), and invite code (GM only). Keyboard-navigable.
// =============================================================================

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from 'react';
import { api } from '../../api/client.js';
import type { Campaign } from 'shared';
import './CampaignCard.css';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface CampaignCardProps {
  /** The campaign to display. */
  campaign: Campaign;
  /** Whether the current user is the GM of this campaign. */
  isGM: boolean;
  /** Called when the user clicks Enter or presses Enter key. */
  onEnter: (campaignId: string) => void;
  /** Called when the user confirms leave. Only used for non-GM cards. */
  onLeave?: (campaignId: string) => void;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '…';
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CampaignCard({ campaign, isGM, onEnter, onLeave }: CampaignCardProps) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const handleEnter = useCallback(() => onEnter(campaign.id), [campaign.id, onEnter]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleEnter();
      }
    },
    [handleEnter],
  );

  useEffect(() => { if (confirmLeave) cancelRef.current?.focus(); }, [confirmLeave]);

  const handleLeaveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmLeave(true);
    setLeaveError(null);
  }, []);

  const handleLeaveConfirm = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLeaveLoading(true);
    setLeaveError(null);
    try {
      await api.delete(`/api/campaigns/${campaign.id}/leave`);
      onLeave?.(campaign.id);
    } catch {
      setLeaveError('Failed to leave campaign.');
    } finally {
      setLeaveLoading(false);
    }
  }, [campaign.id, onLeave]);

  const handleLeaveCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmLeave(false);
  }, []);

  const handleCopyCode = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(campaign.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — fallback to manual select
    }
  }, [campaign.inviteCode]);

  return (
    <div
      className="campaign-card"
      role="button"
      tabIndex={0}
      aria-label={`Enter campaign: ${campaign.name}`}
      onClick={handleEnter}
      onKeyDown={handleKeyDown}
    >
      <div className="campaign-card-header">
        <h3 className="campaign-card-name">{campaign.name}</h3>
        <span className={`campaign-card-role ${isGM ? 'role-gm' : 'role-player'}`}>
          {isGM ? 'GM' : 'Player'}
        </span>
      </div>

      <p className="campaign-card-desc">
        {campaign.description ? truncate(campaign.description, 160) : '\u00A0'}
      </p>

      <div className="campaign-card-footer">
        {isGM ? (
          <button
            type="button"
            className="btn-copy-code"
            onClick={handleCopyCode}
            aria-label={copied ? 'Copied' : `Copy invite code: ${campaign.inviteCode}`}
            title={copied ? 'Copied!' : 'Click to copy invite code'}
          >
            {copied ? '✓ Copied!' : campaign.inviteCode}
          </button>
        ) : (
          <button
            type="button"
            className="btn-leave"
            onClick={handleLeaveClick}
            aria-label={`Leave campaign: ${campaign.name}`}
          >
            Leave
          </button>
        )}
        {campaign.playerCount != null && (
          <span className="campaign-card-players">{campaign.playerCount} player{campaign.playerCount !== 1 ? 's' : ''}</span>
        )}
        <span className="campaign-card-enter">Enter →</span>
      </div>

      {confirmLeave && (
        <div className="leave-overlay" role="alertdialog" aria-label="Confirm leave campaign"
             onClick={(e) => e.stopPropagation()}
             onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setConfirmLeave(false); } }}>
          <div className="leave-dialog">
            <p className="leave-dialog-text">
              Leave <strong>{campaign.name}</strong>? You'll need a new invite code to rejoin.
            </p>
            {leaveError && <p className="leave-dialog-error" role="alert">{leaveError}</p>}
            <div className="leave-dialog-actions">
              <button ref={cancelRef} type="button" className="btn btn-secondary"
                      onClick={handleLeaveCancel} disabled={leaveLoading}>Cancel</button>
              <button type="button" className="btn btn-danger"
                      onClick={handleLeaveConfirm} disabled={leaveLoading}>
                {leaveLoading ? 'Leaving…' : 'Leave Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
