// =============================================================================
// Horizon — NPC Store
// =============================================================================
// Zustand store for NPC library and campaign roster state.
// =============================================================================

import { create } from 'zustand';
import { api } from '../api/client.js';
import type { NPC } from 'shared';

export interface NPCState {
  npcs: NPC[];
  campaignNPCs: NPC[];
  loading: boolean;
  error: string | null;

  fetchMyNPCs: () => Promise<void>;
  createNPC: (name: string, archetype: string) => Promise<NPC>;
  deleteNPC: (npcId: string) => Promise<void>;
  addNPCToCampaign: (campaignId: string, npcId: string) => Promise<void>;
  removeNPCFromCampaign: (campaignId: string, npcId: string) => Promise<void>;
  fetchCampaignNPCs: (campaignId: string) => Promise<void>;
  clearNPCs: () => void;
}

export const useNPCStore = create<NPCState>((set) => ({
  npcs: [],
  campaignNPCs: [],
  loading: false,
  error: null,

  fetchMyNPCs: async () => {
    set({ loading: true, error: null });
    try {
      const npcs = await api.get<NPC[]>('/api/npcs');
      set({ npcs, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to fetch NPCs.', loading: false });
    }
  },

  createNPC: async (name, archetype) => {
    const npc = await api.post<NPC>('/api/npcs', { name, archetype });
    set((s) => ({ npcs: [...s.npcs, npc] }));
    return npc;
  },

  deleteNPC: async (npcId) => {
    await api.delete(`/api/npcs/${npcId}`);
    set((s) => ({ npcs: s.npcs.filter((n) => n.id !== npcId) }));
  },

  addNPCToCampaign: async (campaignId, npcId) => {
    await api.post(`/api/campaigns/${campaignId}/npcs`, { npcId });
  },

  removeNPCFromCampaign: async (campaignId, npcId) => {
    await api.delete(`/api/campaigns/${campaignId}/npcs/${npcId}`);
  },

  fetchCampaignNPCs: async (campaignId) => {
    set({ loading: true });
    try {
      const npcs = await api.get<NPC[]>(`/api/campaigns/${campaignId}/npcs`);
      set({ campaignNPCs: npcs, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch campaign NPCs.',
        loading: false,
      });
    }
  },

  clearNPCs: () => set({ npcs: [], campaignNPCs: [], error: null, loading: false }),
}));
