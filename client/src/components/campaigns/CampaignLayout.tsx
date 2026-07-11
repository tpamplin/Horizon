// =============================================================================
// Horizon — Campaign Layout
// =============================================================================
// Full-viewport shell for inside a campaign. Renders the background layer,
// a collapsible left sidebar with navigation, and a main content area
// for nested routes (Outlet). Fetches campaign detail on mount.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Outlet, useParams, NavLink, Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuthStore } from '../../stores/authStore.js';
import { BackgroundLayer } from '../background/BackgroundLayer.js';
import type { CampaignDetailResponse, NPC } from 'shared';
import './CampaignLayout.css';

// -----------------------------------------------------------------------------
// Navigation items (placeholder routes for future features)
// -----------------------------------------------------------------------------

const NAV_ITEMS = [
  { to: 'sheets',      label: 'Sheets',      icon: '📋' },
  { to: 'dice',        label: 'Dice',         icon: '🎲' },
  { to: 'chat',        label: 'Chat',         icon: '💬' },
  { to: 'backgrounds', label: 'Backgrounds',  icon: '🖼️' },
] as const;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CampaignLayout() {
  const { id } = useParams<{ id: string }>();
  const userId = useAuthStore((s) => s.user?.id);

  const [detail, setDetail] = useState<CampaignDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [campaignNPCs, setCampaignNPCs] = useState<NPC[]>([]);

  // Fetch campaign detail on mount
  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function fetchDetail() {
      try {
        setLoading(true);
        const [data, npcs] = await Promise.all([
          api.get<CampaignDetailResponse>(`/api/campaigns/${id}`),
          api.get<NPC[]>(`/api/campaigns/${id}/npcs`).catch(() => [] as NPC[]),
        ]);
        if (!cancelled) {
          setDetail(data);
          setCampaignNPCs(npcs);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load campaign.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDetail();
    return () => { cancelled = true; };
  }, [id]);

  const toggleSidebar = useCallback(() => setSidebarOpen((s) => !s), []);

  const isGM = detail ? detail.gmUserId === userId : false;

  // Loading / error states
  if (loading) {
    return (
      <div className="layout-loading" role="status" aria-label="Loading campaign">
        <div className="spinner" />
        <p>Entering campaign…</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="layout-error" role="alert">
        <p>{error || 'Campaign not found.'}</p>
      </div>
    );
  }

  return (
    <div className="campaign-layout">
      <BackgroundLayer url={detail.activeBackgroundUrl} />

      <button
        type="button"
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-expanded={sidebarOpen}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? '◀' : '▶'}
      </button>

      <aside className={`campaign-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <header className="sidebar-header">
          <Link to="/campaigns" className="back-link" aria-label="Back to campaigns">← Campaigns</Link>
          <h2 className="sidebar-campaign-name">{detail.name}</h2>
          <span className={`sidebar-role-badge ${isGM ? 'role-gm' : 'role-player'}`}>
            {isGM ? 'GM' : 'Player'}
          </span>
        </header>

        <nav className="sidebar-nav" aria-label="Campaign navigation">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                  aria-current={undefined /* NavLink auto-sets aria-current */}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <footer className="sidebar-footer">
          {(detail.characters?.length ?? 0) > 0 && (
            <div className="sidebar-characters">
              <span className="sidebar-section-title">Characters</span>
              {detail.characters?.map((c) => (
                <Link
                  key={c.id}
                  to={`/campaigns/${id}/characters/${c.id}`}
                  className="character-link"
                >
                  {c.name}
                  <span className="character-archetype">{c.archetype}</span>
                </Link>
              ))}
            </div>
          )}
          {campaignNPCs.length > 0 && (
            <div className="sidebar-characters">
              <span className="sidebar-section-title">NPCs</span>
              {campaignNPCs.map((n) => (
                <Link
                  key={n.id}
                  to={`/npcs/${n.id}`}
                  className="character-link"
                >
                  {n.name}
                  <span className="character-archetype">{n.archetype}</span>
                </Link>
              ))}
            </div>
          )}
          <div className="sidebar-section-title" style={{ marginTop: '0.75rem' }}>Library</div>
          <Link to="/characters" className="character-link">📋 Character Library</Link>
          <Link to="/npcs" className="character-link">👤 NPC Library</Link>
          <div className="sidebar-players" style={{ marginTop: '0.75rem' }}>
            <span className="sidebar-section-title">Players</span>
            {detail.players?.map((p) => (
              <div key={p.userId} className="player-item">
                <span className={`player-dot ${p.role === 'gm' ? 'dot-gm' : 'dot-player'}`} />
                <span className="player-name">{p.displayName}</span>
              </div>
            )) ?? <span className="player-name">No players yet</span>}
          </div>
        </footer>
      </aside>

      <main className="campaign-main">
        <Outlet />
      </main>
    </div>
  );
}
