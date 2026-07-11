// =============================================================================
// Horizon — Home Page
// =============================================================================
// The landing page and authenticated dashboard for Horizon. Extracted from
// App.tsx into its own component with atmospheric styling.
// =============================================================================

import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuthStore } from '../../stores/authStore.js';
import { useCampaignStore } from '../../stores/campaignStore.js';
import { useCharacterStore } from '../../stores/characterStore.js';
import { useNPCStore } from '../../stores/npcStore.js';
import { CampaignCard } from '../campaigns/CampaignCard.js';
import type { Campaign } from 'shared';
import './HomePage.css';

const FEATURES = [
  {
    icon: '🔗',
    title: 'Interconnected Sheets',
    description:
      'Character sheets, NPCs, and campaign data share real-time connections. GM and players always see the latest state.',
  },
  {
    icon: '🎲',
    title: 'Server-Authoritative Dice',
    description:
      'All rolls happen on the server. Results are logged, immutable, and broadcast to the table. The animation is just for show.',
  },
  {
    icon: '⚙️',
    title: 'Custom Mechanics Engine',
    description:
      'Game systems are self-contained plugins. Wild magic, fear trackers, sanity — mix and match per campaign.',
  },
  {
    icon: '🌌',
    title: 'Theater of the Mind',
    description:
      'No tactical battle maps. No grid. No tokens. Just atmosphere, narrative positioning, and shared imagination.',
  },
];

const NAV_TILES = [
  { icon: '🏕️', label: 'My Campaigns', to: '/campaigns', active: true },
  { icon: '📋', label: 'Characters', to: '/characters', active: true },
  { icon: '👤', label: 'NPC Library', to: '/npcs', active: true },
  { icon: '🎲', label: 'Dice Roller', to: null, active: false },
  { icon: '⚙️', label: 'NPC Creator', to: null, active: false },
];

/** What's New banner — update per release to highlight the newest feature. */
const WHATS_NEW = {
  icon: '📋',
  title: 'Character Sheets Are Here',
  description:
    'Create, view, and edit full character sheets — stats, inventory, signature items, special abilities, and more. Your characters live in your personal library and can join any campaign.',
};

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const logout = useAuthStore((s) => s.logout);

  // Store data
  const campaigns = useCampaignStore((s) => s.campaigns);
  const setCampaigns = useCampaignStore((s) => s.setCampaigns);
  const removeCampaign = useCampaignStore((s) => s.removeCampaign);
  const myCharacters = useCharacterStore((s) => s.campaignCharacters);
  const fetchMyCharacters = useCharacterStore((s) => s.fetchMyCharacters);
  const npcs = useNPCStore((s) => s.npcs);
  const fetchMyNPCs = useNPCStore((s) => s.fetchMyNPCs);

  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState<string | null>(null);

  // Fetch dashboard data on mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setDashLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      try {
        setDashLoading(true);
        setDashError(null);
        const [campData] = await Promise.all([
          api.get<Campaign[]>('/api/campaigns'),
          fetchMyCharacters(),
          fetchMyNPCs(),
        ]);
        if (!cancelled) {
          setCampaigns(campData);
        }
      } catch (err) {
        if (!cancelled) {
          setDashError(err instanceof Error ? err.message : 'Failed to load dashboard.');
        }
      } finally {
        if (!cancelled) setDashLoading(false);
      }
    }

    loadDashboard();
    return () => { cancelled = true; };
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Campaign card handlers
  const handleEnterCampaign = useCallback(
    (campaignId: string) => navigate(`/campaigns/${campaignId}`),
    [navigate],
  );

  const handleLeaveCampaign = useCallback(
    (campaignId: string) => removeCampaign(campaignId),
    [removeCampaign],
  );

  return (
    <div className="home">
      {/* Skip-to-content link — first focusable element */}
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      {/* Animated celestial background layers */}
      <div className="home__bg">
        <div className="home__bg-stars" aria-hidden="true" />
        <div className="home__bg-nebula" aria-hidden="true" />
        <div className="home__bg-gradient" aria-hidden="true" />
      </div>

      <main className="home__content" id="main-content">
        {/* ---- Hero ---- */}
        <header className="home__hero">
          <h1 className="home__title">🌅 Horizon</h1>
          <p className="home__tagline">
            A theater-of-the-mind virtual tabletop — built for narrative play.
          </p>
        </header>

        {/* =================================================================
             UNAUTHENTICATED — Landing page for new visitors
             ================================================================= */}
        {!isAuthenticated && (
          <>
            {/* Feature Highlights */}
            <section className="home__features" aria-label="Key features">
              <ul className="home__features-list" role="list">
                {FEATURES.map((f) => (
                  <li key={f.title} role="listitem">
                    <article className="feature-card">
                  <span className="feature-card__icon" aria-hidden="true">
                    {f.icon}
                  </span>
                  <h3 className="feature-card__title">{f.title}</h3>
                  <p className="feature-card__desc">{f.description}</p>
                </article>
                  </li>
              ))}
              </ul>
            </section>

            {/* CTAs */}
            <nav className="home__cta" aria-label="Get started">
              <Link to="/register" className="home__btn home__btn--primary">
                Create Free Account
              </Link>
              <Link to="/login" className="home__btn home__btn--secondary">
                Log In
              </Link>
            </nav>
          </>
        )}

        {/* =================================================================
             AUTHENTICATED — Dashboard for returning users
             ================================================================= */}
        {isAuthenticated && (
          <section className="home__dashboard" aria-label="Dashboard">
            {/* Welcome + Stats */}
            <div className="dash-welcome">
              <h2 className="dash-welcome__name">
                Welcome back, {user?.displayName}.
              </h2>
              <div className="dash-welcome__stats">
                <span className="dash-stat">
                  <strong>{campaigns.length}</strong> campaign{campaigns.length !== 1 ? 's' : ''}
                </span>
                <span className="dash-stat">
                  <strong>{myCharacters.length}</strong> character{myCharacters.length !== 1 ? 's' : ''}
                </span>
                <span className="dash-stat">
                  <strong>{npcs.length}</strong> NPC{npcs.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {dashLoading && (
              <p className="home__dash-loading">Loading your table…</p>
            )}

            {dashError && (
              <p className="home__dash-error" role="alert">{dashError}</p>
            )}

            {!dashLoading && !dashError && (
              <>
                {/* ---- What's New ---- */}
                <section className="dash-whats-new" aria-label="What's new">
                  <span className="dash-whats-new__icon" aria-hidden="true">
                    {WHATS_NEW.icon}
                  </span>
                  <div className="dash-whats-new__content">
                    <h3 className="dash-whats-new__label">What&rsquo;s New</h3>
                    <h4 className="dash-whats-new__title">{WHATS_NEW.title}</h4>
                    <p className="dash-whats-new__desc">{WHATS_NEW.description}</p>
                  </div>
                </section>

                {/* ---- Campaigns ---- */}
                <section className="dash-section" aria-label="Your campaigns">
                  <header className="dash-section__header">
                    <h2>Your Campaigns</h2>
                    <Link to="/campaigns" className="dash-section__link">View all →</Link>
                  </header>

                  {campaigns.length === 0 ? (
                    <div className="dash-empty">
                      <p>No campaigns yet.</p>
                      <Link to="/campaigns" className="home__btn home__btn--primary">
                        Create Your First Campaign
                      </Link>
                    </div>
                  ) : (
                    <div className="dash-campaigns">
                      {campaigns.slice(0, 3).map((c) => (
                        <CampaignCard
                          key={c.id}
                          campaign={c}
                          isGM={c.gmUserId === user?.id}
                          onEnter={handleEnterCampaign}
                          onLeave={handleLeaveCampaign}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* ---- Character Quick-View ---- */}
                <section className="dash-section" aria-label="Your characters">
                  <header className="dash-section__header">
                    <h2>Your Characters</h2>
                    <Link to="/characters" className="dash-section__link">Manage library →</Link>
                  </header>

                  {myCharacters.length === 0 ? (
                    <div className="dash-empty">
                      <p>No characters yet.</p>
                      <Link to="/characters" className="home__btn home__btn--secondary">
                        Build Your First Character
                      </Link>
                    </div>
                  ) : (
                    <div className="dash-chars-scroll" role="list" aria-label="Character quick list">
                      {myCharacters.slice(0, 8).map((ch) => (
                        <Link
                          key={ch.id}
                          to={`/characters/${ch.id}`}
                          className="dash-char-card"
                          role="listitem"
                        >
                          {ch.portraitUrl ? (
                            <img src={ch.portraitUrl} alt="" className="dash-char-card__portrait" />
                          ) : (
                            <div className="dash-char-card__placeholder">
                              {ch.name[0]?.toUpperCase()}
                            </div>
                          )}
                          <span className="dash-char-card__name">{ch.name}</span>
                          <span className="dash-char-card__archetype">{ch.archetype}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                {/* ---- Stay in the Loop ---- */}
                <section className="dash-section dash-activity" aria-label="Recent activity">
                  <h2 className="dash-section__title">Stay in the Loop</h2>
                  <p className="dash-activity__teaser">
                    Soon you&rsquo;ll see notifications here when your GM edits your character sheet,
                    when players join your campaigns, and when new sessions are scheduled.
                  </p>
                </section>

                {/* ---- Upcoming Sessions ---- */}
                <section className="dash-section dash-activity" aria-label="Upcoming sessions">
                  <h2 className="dash-section__title">Upcoming Sessions</h2>
                  <p className="dash-activity__teaser">
                    Session scheduling is coming. Your GM will be able to set a date and time,
                    and you&rsquo;ll see a countdown right here on your dashboard — no more
                    &ldquo;what time are we playing?&rdquo; in the group chat.
                  </p>
                </section>

                {/* ---- Navigation Tiles ---- */}
                <section className="dash-section" aria-label="Quick navigation">
                  <h2 className="dash-section__title">Tools &amp; Features</h2>
                  <div className="dash-tiles">
                    {NAV_TILES.map((tile) =>
                      tile.active && tile.to ? (
                        <Link key={tile.label} to={tile.to} className="dash-tile dash-tile--active">
                          <span className="dash-tile__icon" aria-hidden="true">{tile.icon}</span>
                          <span className="dash-tile__label">{tile.label}</span>
                        </Link>
                      ) : (
                        <div
                          key={tile.label}
                          className="dash-tile dash-tile--coming"
                          tabIndex={0}
                          role="link"
                          aria-disabled="true"
                          aria-label={`${tile.label} — Coming soon`}
                        >
                          <span className="dash-tile__icon" aria-hidden="true">{tile.icon}</span>
                          <span className="dash-tile__label">{tile.label}</span>
                          <span className="dash-tile__badge" aria-label="Coming soon">Coming Soon</span>
                        </div>
                      ),
                    )}
                  </div>
                </section>
              </>
            )}

            <button type="button" className="home__logout" onClick={logout}>
              Log Out
            </button>
          </section>
        )}

        {/* ---- Footer ---- */}
        <footer className="home__footer">
          <p>Horizon VTT &copy; 2026 — Phase 1.3</p>
        </footer>
      </main>
    </div>
  );
}
