// =============================================================================
// Horizon — Campaign Store
// =============================================================================
// Zustand store for campaign state. Manages the list of campaigns the user
// belongs to and which campaign is currently active.
// Expanded with real data fetching in Phase 1.
// =============================================================================

import { create } from 'zustand';
import type { Campaign } from 'shared';

export interface CampaignState {
  /** All campaigns the current user belongs to (as player or GM). */
  campaigns: Campaign[];
  /** The ID of the currently active/viewed campaign, or null if none selected. */
  activeCampaignId: string | null;
  /** Replace the entire campaigns list (e.g. after fetching from the server). */
  setCampaigns: (campaigns: Campaign[]) => void;
  /** Set the active campaign. Pass null to deselect. */
  setActiveCampaign: (campaignId: string | null) => void;
  /** Add a single campaign to the list (e.g. after creating a new one). */
  addCampaign: (campaign: Campaign) => void;
  /** Remove a campaign from the list (e.g. after leaving or deleting). */
  removeCampaign: (campaignId: string) => void;
}

export const useCampaignStore = create<CampaignState>((set) => ({
  campaigns: [],
  activeCampaignId: null,
  setCampaigns: (campaigns) => set({ campaigns }),
  setActiveCampaign: (campaignId) => set({ activeCampaignId: campaignId }),
  addCampaign: (campaign) => set((state) => ({ campaigns: [...state.campaigns, campaign] })),
  removeCampaign: (campaignId) =>
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== campaignId),
      activeCampaignId: state.activeCampaignId === campaignId ? null : state.activeCampaignId,
    })),
}));
