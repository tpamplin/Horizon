// =============================================================================
// Horizon — HomePage Tests
// =============================================================================
// Vitest + React Testing Library tests for the homepage component.
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage.js';

// -----------------------------------------------------------------------------
// Mock stores
// -----------------------------------------------------------------------------

const mockLogout = vi.fn();
const mockSetCampaigns = vi.fn();
const mockRemoveCampaign = vi.fn();
const mockFetchMyCharacters = vi.fn().mockResolvedValue(undefined);
const mockFetchMyNPCs = vi.fn().mockResolvedValue(undefined);

let mockIsAuthenticated = false;
let mockUser: { id: string; displayName: string } | null = null;
let mockCampaigns: unknown[] = [];
let mockCharacters: unknown[] = [];
let mockNPCs: unknown[] = [];

vi.mock('../../stores/authStore.js', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => {
    const state = {
      user: mockUser,
      isAuthenticated: () => mockIsAuthenticated,
      logout: mockLogout,
    };
    return selector(state);
  },
}));

vi.mock('../../stores/campaignStore.js', () => ({
  useCampaignStore: (selector: (s: unknown) => unknown) => {
    const state = {
      campaigns: mockCampaigns,
      setCampaigns: mockSetCampaigns,
      removeCampaign: mockRemoveCampaign,
    };
    return selector(state);
  },
}));

vi.mock('../../stores/characterStore.js', () => ({
  useCharacterStore: (selector: (s: unknown) => unknown) => {
    const state = {
      campaignCharacters: mockCharacters,
      fetchMyCharacters: mockFetchMyCharacters,
    };
    return selector(state);
  },
}));

vi.mock('../../stores/npcStore.js', () => ({
  useNPCStore: (selector: (s: unknown) => unknown) => {
    const state = {
      npcs: mockNPCs,
      fetchMyNPCs: mockFetchMyNPCs,
    };
    return selector(state);
  },
}));

vi.mock('../../api/client.js', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
  },
}));

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

/** Wait for dashboard data to finish loading. */
async function waitForDashboard() {
  await waitFor(() => {
    expect(screen.queryByText('Loading your table…')).not.toBeInTheDocument();
  });
}

// -----------------------------------------------------------------------------
// Unauthenticated tests
// -----------------------------------------------------------------------------

describe('HomePage — unauthenticated', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockUser = null;
    mockCampaigns = [];
    mockCharacters = [];
    mockNPCs = [];
  });

  it('renders the landing hero with title and tagline', () => {
    renderHomePage();
    expect(screen.getByText('🌅 Horizon')).toBeInTheDocument();
    expect(screen.getByText(/theater-of-the-mind virtual tabletop/)).toBeInTheDocument();
  });

  it('renders all 4 feature highlight cards', () => {
    renderHomePage();
    expect(screen.getByText('Interconnected Sheets')).toBeInTheDocument();
    expect(screen.getByText('Server-Authoritative Dice')).toBeInTheDocument();
    expect(screen.getByText('Custom Mechanics Engine')).toBeInTheDocument();
    expect(screen.getByText('Theater of the Mind')).toBeInTheDocument();
  });

  it('renders feature cards as list items', () => {
    renderHomePage();
    const list = screen.getByRole('list');
    expect(list).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(4);
  });

  it('renders Register and Login links with correct routes', () => {
    renderHomePage();
    expect(screen.getByRole('link', { name: /create free account/i })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(screen.getByRole('link', { name: /log in/i })).toHaveAttribute('href', '/login');
  });

  it('does not render the dashboard', () => {
    renderHomePage();
    expect(screen.queryByLabelText('Dashboard')).not.toBeInTheDocument();
  });

  it('does not show the logout button', () => {
    renderHomePage();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// Authenticated — sync content (renders immediately, before async data)
// -----------------------------------------------------------------------------

describe('HomePage — authenticated (sync)', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    mockUser = { id: 'user-1', displayName: 'Aria' };
    mockCampaigns = [];
    mockCharacters = [];
    mockNPCs = [];
  });

  it('renders the dashboard region', () => {
    renderHomePage();
    expect(screen.getByLabelText('Dashboard')).toBeInTheDocument();
  });

  it('displays welcome message with display name', () => {
    renderHomePage();
    expect(screen.getByText(/welcome back, aria/i)).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    renderHomePage();
    expect(screen.getByText('Loading your table…')).toBeInTheDocument();
  });

  it('logout button calls authStore.logout', () => {
    renderHomePage();
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders the skip-to-content link', () => {
    renderHomePage();
    const skipLink = screen.getByRole('link', { name: /skip to content/i });
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('main has skip-link target id', () => {
    renderHomePage();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('renders the footer', () => {
    renderHomePage();
    expect(screen.getByText(/horizon vtt/i)).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
// Authenticated — async (after dashboard data loads)
// -----------------------------------------------------------------------------

describe('HomePage — authenticated (async)', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    mockUser = { id: 'user-1', displayName: 'Aria' };
    mockCampaigns = [];
    mockCharacters = [];
    mockNPCs = [];
  });

  it('shows empty campaign state after loading', async () => {
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByText('No campaigns yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create your first campaign/i })).toBeInTheDocument();
  });

  it('shows empty character state after loading', async () => {
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByText('No characters yet.')).toBeInTheDocument();
  });

  it('renders campaign cards when campaigns exist', async () => {
    mockCampaigns = [
      {
        id: 'camp-1',
        name: 'The Shattered Realm',
        description: 'A world undone.',
        gmUserId: 'user-1',
        inviteCode: 'ABC123',
        rulesetVersion: 'horizon-v1',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByText('The Shattered Realm')).toBeInTheDocument();
  });

  it('renders character quick-view when characters exist', async () => {
    mockCharacters = [
      {
        id: 'char-1',
        name: 'Kael',
        archetype: 'Warrior',
        portraitUrl: null,
        playerUserId: 'user-1',
        sheetData: {},
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByText('Kael')).toBeInTheDocument();
    expect(screen.getByText('Warrior')).toBeInTheDocument();
  });

  it('renders active navigation tile labels', async () => {
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByText('My Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Characters')).toBeInTheDocument();
    expect(screen.getByText('NPC Library')).toBeInTheDocument();
  });

  it('renders coming-soon tiles with badges', async () => {
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByText('Dice Roller')).toBeInTheDocument();
    expect(screen.getByText('NPC Creator')).toBeInTheDocument();
    const badges = screen.getAllByText('Coming Soon');
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it('coming-soon tiles are aria-disabled and focusable', async () => {
    renderHomePage();
    await waitForDashboard();
    const diceTile = screen.getByRole('link', { name: /dice roller.*coming soon/i });
    expect(diceTile).toHaveAttribute('aria-disabled', 'true');
    expect(diceTile).toHaveAttribute('tabindex', '0');
  });

  it('renders the What\'s New banner', async () => {
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByText('Character Sheets Are Here')).toBeInTheDocument();
  });

  it('renders stay in the loop section', async () => {
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByText('Stay in the Loop')).toBeInTheDocument();
  });

  it('renders upcoming sessions teaser', async () => {
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByText('Upcoming Sessions')).toBeInTheDocument();
  });

  it('character quick-view uses list role', async () => {
    mockCharacters = [
      {
        id: 'char-1',
        name: 'Kael',
        archetype: 'Warrior',
        portraitUrl: null,
        playerUserId: 'user-1',
        sheetData: {},
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByRole('list', { name: /character quick list/i })).toBeInTheDocument();
  });

  it('navigation section has aria-label', async () => {
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByLabelText('Quick navigation')).toBeInTheDocument();
  });

  it('campaigns section has aria-label', async () => {
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByLabelText('Your campaigns')).toBeInTheDocument();
  });

  it('characters section has aria-label', async () => {
    renderHomePage();
    await waitForDashboard();
    expect(screen.getByLabelText('Your characters')).toBeInTheDocument();
  });

  it('feature section has aria-label when unauthenticated', () => {
    mockIsAuthenticated = false;
    renderHomePage();
    expect(screen.getByLabelText('Key features')).toBeInTheDocument();
  });
});
