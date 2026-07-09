# 🌅 Horizon — High-Level Design Document

> **Status:** Revised · **Date:** 2026-07-09
> **Name:** Horizon — because everyone at the table is looking at the same horizon, imagining the same world, each from a slightly different angle.
> **Vision:** A theater-of-the-mind virtual tabletop built around interconnected character sheets, GM storytelling tools, and custom mechanics engines — no tactical battle maps, no tokens, just shared imagination.

---

## 1. Overview

Horizon is both the software and the game system — a unified, lightweight, theater-of-the-mind VTT with its own custom TTRPG ruleset. Unlike grid-and-token VTTs, Horizon is designed for narrative play — the table is a shared space for character sheets, dice, atmosphere, and custom game mechanics. The rules are coded into the platform rather than written in a separate rulebook.

**Core principles:**

- **Theater of the mind** — no tactical battle maps or token positioning; the story happens in everyone's heads. City-scale maps for narrative positioning are the one exception (see §4.10).
- **Interconnected sheets** — GM and players share real-time character data; GM can edit anything on the fly
- **Atmosphere over simulation** — dynamic backgrounds set the mood; music and ambience (future) reinforce it
- **Server-authoritative dice** — players roll, server logs, no fudging
- **Custom mechanics engine** — the Wild Magic Generator is the first of many pluggable game systems

The existing Wild Magic Generator proves the UI patterns and rules engine. The VTT expands this into a multiplayer platform with persistent campaigns.

---

## 2. Tech Stack (Zero-Budget)

| Layer             | Technology                     | Rationale                                                             |
| ----------------- | ------------------------------ | --------------------------------------------------------------------- |
| **Frontend**      | React 19 + TypeScript + Vite   | Proven; already built and working                                     |
| **Styling**       | CSS (plain, as in Wild Magic)  | Zero dependencies; dark theme already dialed in                       |
| **Real-time**     | WebSockets (Socket.IO)         | Free, mature, works everywhere                                        |
| **Backend**       | Node.js + Fastify              | Single process handles HTTP + WS; no separate servers                 |
| **Database**      | SQLite (via better-sqlite3)    | Zero cost, zero config, file-based; JSON columns for flexible data    |
| **Auth**          | JWT (jsonwebtoken) + bcrypt    | No third-party services needed; email/password is free                |
| **File Storage**  | Local filesystem               | Portraits, backgrounds saved to `./data/uploads/`; back up the folder |
| **Hosting**       | Self-hosted or free-tier cloud | Run on a home machine, old laptop, or free cloud tier (see §2.1)      |
| **Testing**       | Vitest + Playwright            | Unit tests (Vitest) + E2E browser tests (Playwright); both free       |
| **Accessibility** | ARIA + keyboard navigation     | Semantic HTML; sheets, chat, and dice are keyboard-operable           |
| **Maps**          | Leaflet + OpenStreetMap        | Free, no API key required; real city maps for narrative positioning   |

### 2.1 Zero-Budget Hosting Options

The app is a single Node.js process + a SQLite file. It can run anywhere Node runs.

| Option                        | Cost                   | Notes                                                                                     |
| ----------------------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| **Render**                    | Free tier (750 hrs/mo) | ✅ Chosen for MVP — push-to-deploy, no credit card, auto-wakes on request                 |
| **Railway**                   | Free tier (500 hrs/mo) | Good fallback; similar developer experience                                               |
| **Home machine**              | Free                   | Run on gaming PC during sessions; simplest option, no latency                             |
| **Old laptop / Raspberry Pi** | Free                   | Dedicated always-on server; good if you have spare hardware lying around                  |
| **Fly.io**                    | Free tier (3 VMs)      | Another solid option if Render/Railway don't work out                                     |
| **Oracle Cloud**              | Always-free tier       | 4 ARM cores, 24 GB RAM — massive overkill; account termination risk; requires credit card |

**Decision: Render free tier.** At ~10 hours/month with 5 players, you'll use roughly 50 server-hours — about 7% of the 750-hour cap. The app spins down when idle, wakes automatically when someone connects. No credit card required. If usage ever exceeds the free tier, Railway or a home server are easy fallbacks. Back up the SQLite file regularly (it's a single file — just download it) and you're safe no matter what happens.

### 2.2 Why SQLite?

- **Zero cost, zero setup.** No database server to install or pay for.
- **Single file.** Back up the entire database by copying one file.
- **Fast enough.** For a small group (4-8 concurrent users), SQLite handles the load easily.
- **JSON support.** SQLite has JSON functions for querying into `sheet_data`.
- **Proven pattern.** The Wild Magic Generator already uses file-based persistence (localStorage + JSON export). SQLite is the natural server-side equivalent.

If the app ever outgrows SQLite (hundreds of concurrent users), migrating to PostgreSQL is straightforward — same SQL, just change the driver.

---

## 3. System Architecture

```
┌──────────────────────────────────────────────┐
│              Client (Browser)                 │
│  ┌───────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Character │ │  Chat +  │ │  GM Tools   │ │
│  │  Sheets   │ │  Dice    │ │  Panel      │ │
│  └───────────┘ └──────────┘ └─────────────┘ │
│  ┌───────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Mechanics │ │   NPC    │ │  Campaign   │ │
│  │  Engine   │ │ Generator│ │  Manager    │ │
│  └───────────┘ └──────────┘ └─────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │            City Map Layer               │ │
│  └─────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────┐ │
│  │        Dynamic Background Layer         │ │
│  └─────────────────────────────────────────┘ │
└─────────────────┬────────────────────────────┘
                  │ WebSocket + REST
┌─────────────────▼────────────────────────────┐
│              Backend Server                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │  Auth    │ │  Game    │ │  REST API    │ │
│  │  Service │ │  Engine  │ │  (CRUD)      │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │  Dice    │ │   NPC    │ │  Campaign    │ │
│  │  Service │ │   Gen    │ │  Manager     │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
└─────────────────┬────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────┐
│           SQLite Database (single file)        │
│  users │ campaigns │ characters │ npcs       │
│  sessions │ dice_logs │ chat_messages        │
│  backgrounds │ mechanics │ handouts          │
└──────────────────────────────────────────────┘
```

---

## 4. Core Features

### 4.1 User System

| Feature           | Details                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| **Registration**  | Email/password or OAuth (Google, Discord)                                                     |
| **Login**         | JWT-based; access token (15 min) + refresh token (7 days) for persistence                     |
| **Token refresh** | Silent refresh via `POST /api/auth/refresh`; client intercepts 401s and retries transparently |
| **Profile**       | Avatar, display name, timezone                                                                |
| **Roles**         | Player, GM (per campaign)                                                                     |

**Auth flow:** On login, the server returns a short-lived access token (JWT, 15-minute expiry) and a long-lived refresh token (opaque, stored hashed in the `refresh_tokens` table). The client sends the access token as a Bearer header on REST calls and as an `auth` message on WebSocket connect. When a 401 is received, the client silently calls `POST /api/auth/refresh` with the refresh token to get a new access token — no re-login required. Refresh tokens are rotated on each use (old one invalidated, new one issued) to limit exposure from stolen tokens.

### 4.2 Campaign Management

A **Campaign** is the top-level container. One GM, many players. All data is scoped to a campaign.

| Entity        | Description                                               |
| ------------- | --------------------------------------------------------- |
| **Campaign**  | Name, description, ruleset version, active background     |
| **Session**   | Single play session; date, summary, attendance log        |
| **Player**    | User invited to campaign; can control assigned characters |
| **Character** | Player character sheet (Horizon system stats + custom)    |
| **NPC**       | Non-player character; generated or manual                 |
| **Handout**   | Image, note, or document shared with players              |

#### Data Model (simplified)

```sql
users
  id, email, display_name, avatar_url, created_at

campaigns
  id, name, description, gm_user_id, active_background_url, created_at

campaign_players
  campaign_id, user_id, role (gm/player)

characters
  id, campaign_id, player_user_id, name, portrait_url, sheet_data (JSON), created_at

npcs
  id, campaign_id, name, portrait_url, template_id, sheet_data (JSON), is_generated

sessions
  id, campaign_id, date, summary, notes

session_attendance
  session_id, user_id, character_id

dice_logs
  id, campaign_id, session_id, roller_user_id, character_id, pool, results, total, reason, rolled_at

chat_messages
  id, campaign_id, session_id, user_id, type (text/dice/system), content (JSON), sent_at
```

`sheet_data` is stored as JSON text — flexible, no migrations needed:

```json
{
  "stats": {
    "cognition": 3,
    "force": 2,
    "reflex": 4,
    "conflict": 1,
    "influence": 3,
    "stability": 2
  },
  "adversity_tokens": 6,
  "traits": ["Brave", "Clumsy"],
  "inventory": [
    { "name": "Lucky charm", "qty": 1, "notes": "" },
    { "name": "Dad's old revolver", "qty": 1, "notes": "3 bullets left" }
  ],
  "conditions": ["Shaken"],
  "notes": "Afraid of heights"
}
```

### 4.3 Character Sheets (Real-Time)

The heart of the app. Character sheets are **live documents** — GM and owning player can edit simultaneously; changes sync in real-time via WebSocket.

| Feature              | Details                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| **Live editing**     | GM can edit any sheet in real-time; player sees changes instantly      |
| **Stat display**     | 6 stats: Cognition, Force, Reflex, Conflict, Influence, Stability      |
| **Adversity tokens** | Tracked per-character; GM awards/deducts with one click                |
| **Inventory**        | Named items with quantity and notes; GM can add/remove at any time     |
| **Conditions**       | Active status effects (e.g., "Shaken", "Injured")                      |
| **Traits**           | Freeform character traits                                              |
| **Portrait**         | Uploadable character portrait                                          |
| **Dice integration** | Click a stat to roll; sheet sends correct dice pool to server          |
| **GM view**          | GM sees all sheets in a dock; can open any, make hidden edits          |
| **Narrative mode**   | Full-screen "spotlight" view for a single character during key moments |

#### WebSocket Events (sheet sync)

```
Client → Server:  sheet:update { character_id, path: "stats.cognition", value: 4 }
Server → All:     sheet:updated { character_id, updated_by: "gm", changes: {...} }

Client → Server:  sheet:addItem { character_id, item: { name: "Flashlight", qty: 1 } }
Server → All:     sheet:itemAdded { character_id, item: {...} }

Client → Server:  sheet:removeItem { character_id, item_index: 2 }
Server → All:     sheet:itemRemoved { character_id, item_index: 2 }
```

### 4.4 Dynamic Backgrounds

Instead of battle maps, the GM sets a **scene background** — an image or color that fills the screen for all players. It sets the mood without pretending to be a tactical map.

| Feature             | Details                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **GM-controlled**   | GM picks a background from a library or uploads custom                                        |
| **Instant sync**    | All players see the new background within seconds                                             |
| **Preset library**  | Bundled scenes: spooky forest, small-town diner, high school hallway, abandoned factory, etc. |
| **Custom uploads**  | GM uploads their own images                                                                   |
| **Transitions**     | Optional crossfade when changing scenes                                                       |
| **Per-scene notes** | GM can attach a short description visible only to them                                        |

The background is purely atmospheric — no grid, no tokens, no measurements. It just sets the vibe.

### 4.5 Dice Engine

Server-authoritative. Simple, functional, trustworthy. No 3D physics simulation — just a clean animation and a provably fair result.

| Feature           | Details                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| **Standard dice** | d4, d6, d8, d10, d12, d20, d100                                              |
| **Pool rolls**    | Horizon: stat dice + adversity dice (e.g., "3d6 + 2a")                      |
| **Quick roll**    | Click a stat on any sheet → auto-rolls correct pool                          |
| **Custom roll**   | Freeform input: "2d8 + 1d6"                                                  |
| **Animation**     | Simple dice-spin animation (~1 second), then result reveal                   |
| **History**       | Full dice log per session; shows who rolled what and why                     |
| **Hidden rolls**  | GM-only rolls; players see "GM rolled in secret"                             |
| **Anti-cheat**    | All random generation happens server-side; results are immutable once logged |

#### WebSocket Events (dice)

```
Client → Server:  dice:roll { pool: "3d6", reason: "Cognition check", character_id }
Server → All:     dice:result {
                    roller: "Alice", character: "Jamie", pool: "3d6",
                    results: [4, 5, 2], total: 11, reason: "Cognition check"
                  }
```

### 4.6 Chat

Text chat with dice roll embeds and system messages.

| Feature         | Details                                                         |
| --------------- | --------------------------------------------------------------- |
| **Group chat**  | Everyone in the campaign sees it                                |
| **Whispers**    | Private messages between two users                              |
| **Dice embeds** | Rolls appear as styled cards showing pool and result            |
| **System log**  | Automated messages: "GM changed the background", "Alice joined" |

### 4.7 NPC Generator

Rapid NPC creation for GMs. Pick an archetype template, set the threat level, and generate a fully statted NPC in one click.

#### Archetype Templates

Each template defines stat weights, trait pools, and item pools for a character type:

| Archetype     | Stat Focus           | Example Traits               | Example Items                    |
| ------------- | -------------------- | ---------------------------- | -------------------------------- |
| **Bully**     | Force, Conflict      | Intimidating, Cruel          | Brass knuckles, Stolen wallet    |
| **Nerd**      | Cognition, Stability | Book-smart, Socially awkward | Graphing calculator, Sci-fi book |
| **Jock**      | Force, Reflex        | Competitive, Loyal           | Letterman jacket, Protein bar    |
| **Outsider**  | Stability, Influence | Mysterious, Observant        | Switchblade, Zippo lighter       |
| **Authority** | Influence, Conflict  | Stern, By-the-book           | Badge, Handcuffs                 |
| **Weirdo**    | Cognition (wildcard) | Uncanny, Prophetic           | Odd trinket, Hand-drawn map      |

#### Generation Algorithm

1. **Pick template** — GM selects an archetype (or hits "Random")
2. **Set threat level** — slider adjusts stat pools and dice counts:
   - _Pushover:_ 2–3 total stat points, d4 adversity die, 0–1 traits
   - _Threatening:_ 6–8 total stat points, d8 adversity die, 2–3 traits
   - _Deadly:_ 10–12 total stat points, d12 adversity die, 3–4 traits
3. **Generate** — server rolls stats, picks traits/items from template pools, rolls a plot hook
4. **Tweak** — GM can adjust any field before saving; generated NPCs are editable

#### Plot Hooks

Each generated NPC comes with a plot hook — a one-sentence story prompt like:

- "Knows a secret about the mayor and is willing to trade it"
- "Has been following the party for three days"
- "Owes a debt to the same person the party is looking for"

#### Name Generator

Themed name lists by era/tone (80s small-town, modern urban, rural gothic). GM picks a theme; names are drawn from weighted Markov chains built from curated name lists. Names come with an optional quirk (e.g., "Goes by their middle name", "Mispronounces it on purpose").

### 4.8 Custom Mechanics Engine

The Wild Magic Generator is the first proof-of-concept. The VTT generalizes this pattern: **any custom game mechanic can be built as a pluggable tool.**

| Concept             | Description                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| **Mechanic plugin** | A self-contained React component + server-side logic for one game system                            |
| **Campaign config** | GM enables/disables mechanics per campaign                                                          |
| **Examples**        | Wild Magic, Fear/Sanity tracker, Chase sequence engine, Clue web, Crafting                          |
| **Shared state**    | Mechanics read/write character sheet data (e.g., Wild Magic tracks discovered spells per character) |
| **Output**          | Results post to chat and dice log; some mechanics have their own panel                              |

#### Plugin Interface (TypeScript sketch)

```ts
interface GameMechanic {
  id: string; // "wild-magic", "fear-tracker"
  name: string; // "Wild Magic Generator"
  description: string;
  category: 'dice' | 'tracker' | 'generator' | 'narrative';
  Component: React.FC<MechanicProps>;
  serverHandler?: (event: MechanicEvent, ctx: MechanicContext) => Promise<MechanicResult>;
}

interface MechanicProps {
  campaignId: string;
  characterId?: string; // which character is invoking it
  characters: Character[]; // all characters in campaign (for reading state)
  onResult: (result: MechanicResult) => void;
  onUpdateSheet: (characterId: string, changes: SheetChanges) => void;
}
```

This means the VTT ships with a few built-in mechanics, and advanced users (or future development) can add more without touching core code.

#### WebSocket Events (mechanics)

Mechanics are invoked via WebSocket, not REST — they produce real-time results broadcast to all players in the campaign:

```
Client → Server:  mechanic:invoke { mechanic_id: "wild-magic", params: {...}, character_id }
Server → All:     mechanic:result {
                    mechanic_id: "wild-magic",
                    invoked_by: "Alice",
                    character_id: "char_abc",
                    result: { ... },
                    posted_to_chat: true
                  }
```

### 4.9 Music & Ambience (Future)

- GM queues audio tracks
- Synced playback for all players
- Pre-built playlists ("Spooky Forest", "Chase Scene", "Emotional Revelation")

### 4.10 City Maps

Not battle maps — **narrative positioning maps.** For campaigns set in real towns, a shared city map gives everyone a sense of place without turning into a tactical wargame. No grid, no tokens, no measurement tools. Just a map, some pins, and a shared understanding of where things are.

| Feature                 | Details                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| **Real city tiles**     | OpenStreetMap via Leaflet — any city in the world, free, no API key                  |
| **Location pins**       | GM drops labeled pins: "The Diner", "Abandoned Factory", "Jamie's House"             |
| **Character pins**      | Each character gets a colored pin with their portrait; player or GM can move it      |
| **GM-only pins**        | Hidden pins visible only to GM: "Cultist hideout", "Monster's lair"                  |
| **Pin categories**      | Color-coded by type: location (blue), character (green), threat (red), clue (yellow) |
| **Shared view**         | GM sets the map center + zoom; all players see the same view                         |
| **Real-time sync**      | Pins added/moved/removed sync instantly via WebSocket                                |
| **Search**              | Search for any real address or place name → map jumps to it                          |
| **Fog of war (future)** | GM can obscure areas the party hasn't discovered yet                                 |

#### Why not just use Google Maps in another tab?

- **Shared state:** Everyone sees the same pins at the same time. No "wait, which diner? The one on 5th or the one on Main?"
- **Character tracking:** See where each PC is at a glance. "Jamie's at the library, Alex is at the police station."
- **GM overlay:** Hidden pins and notes live on the map, not in a separate notebook.
- **Persistent:** Pins survive between sessions. The map accumulates the campaign's history.
- **No context switch:** Map is inside the VTT, next to sheets, dice, and chat.

#### WebSocket Events (map)

```
Client → Server:  map:addPin    { lat, lng, label, color, category, character_id? }
Server → All:     map:pinAdded  { pin_id, ... }

Client → Server:  map:movePin   { pin_id, lat, lng }
Server → All:     map:pinMoved  { pin_id, lat, lng, moved_by: "Alice" }

Client → Server:  map:removePin { pin_id }
Server → All:     map:pinRemoved { pin_id }

Client → Server:  map:setView   { center_lat, center_lng, zoom }
Server → All:     map:viewChanged { center_lat, center_lng, zoom, set_by: "GM" }
```

---

## 5. Development Phases

### Phase 1 — Foundation (MVP)

- User auth (register, login, logout)
- Campaign CRUD (create, join, leave)
- Character sheet (stats, adversity tokens, inventory, traits — no real-time yet)
- Server-authoritative dice roller with history log
- Text chat with dice embeds
- Dynamic backgrounds (preset library + GM upload)

### Phase 2 — Real-Time Core

- WebSocket server + client connection
- Real-time character sheet sync (GM edits any sheet live)
- Real-time inventory management (add/remove items)
- Campaign lobby (online presence, who's viewing what)
- GM role and permissions enforcement
- Session management (start/end, attendance log)

### Phase 3 — Mechanics & Tools

- Port Wild Magic Generator as first GameMechanic plugin
- NPC Generator with templates
- Name generator
- Mechanic plugin API stabilized
- Fear/Sanity tracker (second mechanic)
- GM screen: all sheets in a dock, quick-access tools
- City Maps: real-world city maps with pins for narrative positioning (see §4.10)

### Phase 4 — Atmosphere & Polish

- Music/ambience system
- Narrative spotlight mode (full-screen character focus)
- Custom mechanic builder (GM configures simple mechanics without code)
- Background transition effects
- Mobile-responsive layout

### Phase 5 — Ecosystem

- Import/export entire campaigns
- Community template sharing (NPCs, backgrounds, mechanics)
- Public API for third-party integrations
- Advanced permission system (co-GM, spectator mode)

---

## 6. Key Design Decisions

### Theater of the Mind (Narrative Maps Only)

Deliberately no tactical battle maps — no grid, no tokens, no measurements. This is a storytelling VTT — the "table" is a shared space for sheets, dice, and atmosphere. The dynamic background sets mood; the GM's narration sets the scene. This dramatically reduces scope and keeps the app focused on what the system does well.

The one exception: **city-scale maps.** Many Horizon stories take place in real towns where spatial relationships matter — "the library is across town from the diner." A shared real-world map (OpenStreetMap via Leaflet) lets the GM and players drop pins, mark locations, and track where everyone is in the city. No grid, no tokens — just a shared sense of place. See §4.10.

### Server-Authoritative Dice

All random generation happens on the server. Players request rolls; the server generates, logs, and broadcasts. The dice animation is purely cosmetic. This prevents cheating and creates an auditable history.

### JSON Sheets (SQLite)

Character sheets are stored as JSON text in SQLite columns. No schema migrations when adding new stats, traits, or mechanics. The frontend validates structure; the database just stores it. SQLite has built-in JSON functions for querying into sheet data when needed.

### Pluggable Mechanics

Game mechanics (Wild Magic, fear tracker, etc.) are self-contained plugins with a standard interface. They read/write character data and post results to chat/dice log. The VTT core doesn't need to know about every system — it just provides the platform.

### Real-Time Sheet Sync

Character sheets use **field-level last-write-wins** over WebSocket. Each field update carries a server timestamp; on collision (GM and player edit the same field near-simultaneously), the last arriving write wins and is broadcast to all clients. Because edits are at the field level — a single stat, one inventory item, one condition — the blast radius of a conflict is at most one field briefly out of sync. This is simpler and more predictable than full operational transforms for this use case.

**Presence indicators:** When the GM has a player's sheet open, that player sees a subtle "GM is viewing" badge. When the GM is actively editing a field, it shows a colored highlight (e.g., a purple left-border) so the player knows a change is incoming. These cues prevent the jarring "my sheet just changed without warning" experience.

**Undo:** The server keeps a short per-sheet edit log (last 50 operations per character). GM and owning player can undo their own recent changes via `sheet:undo`. Undo results are broadcast so everyone stays in sync.

**Hidden edits:** The GM can toggle "hidden mode" to stage changes that only take effect when revealed — useful for surprise conditions, secret inventory additions, or delayed stat penalties.

---

## 7. API Sketch (REST)

```
POST   /api/auth/register              { email, password, display_name }
POST   /api/auth/login                 { email, password } → { access_token, refresh_token, user }
POST   /api/auth/refresh               { refresh_token } → { access_token, refresh_token }
GET    /api/auth/me                    → { user }

GET    /api/campaigns                  → [campaigns]
POST   /api/campaigns                  { name, description } → { campaign }
GET    /api/campaigns/:id              → { campaign, players, characters }
POST   /api/campaigns/:id/join         { invite_code } → { player }
DELETE /api/campaigns/:id/leave        → {}

GET    /api/campaigns/:id/characters             → [characters]
POST   /api/campaigns/:id/characters             { name, sheet_data } → { character }
PUT    /api/campaigns/:id/characters/:cid        { sheet_data } → { character }

GET    /api/campaigns/:id/npcs                   → [npcs]
POST   /api/campaigns/:id/npcs                   { name, sheet_data } → { npc }
POST   /api/campaigns/:id/npcs/generate          { template_id, threat_level } → { npc }

GET    /api/campaigns/:id/sessions               → [sessions]
POST   /api/campaigns/:id/sessions               { date, summary } → { session }

POST   /api/campaigns/:id/background             { url } → { campaign }
GET    /api/backgrounds/library                  → [preset backgrounds]

GET    /api/campaigns/:id/map/pins               → [map pins]
POST   /api/campaigns/:id/map/pins               { lat, lng, label, color, category, character_id? } → { pin }
DELETE /api/campaigns/:id/map/pins/:pid          → {}
PUT    /api/campaigns/:id/map/view               { center_lat, center_lng, zoom } → { campaign }

GET    /api/campaigns/:id/dice-log?session=:sid  → [dice entries]

GET    /api/mechanics                            → [available mechanics]
PUT    /api/campaigns/:id/mechanics              { enabled: ["wild-magic", "fear-tracker"] }

GET    /api/npc-templates                        → [templates]
GET    /api/name-generator?theme=modern          → { names: [...] }
```

---

## 8. Project Structure (Proposed)

```
horizon/
├── client/                        # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── sheets/            # Character + NPC sheet views
│   │   │   ├── chat/              # Chat panel, dice embeds
│   │   │   ├── dice/              # Dice tray, roll history
│   │   │   ├── background/        # Dynamic background layer
│   │   │   ├── gm/                # GM tools: sheet dock, quick-edit
│   │   │   ├── npc-gen/           # NPC generator UI
│   │   │   ├── maps/              # City map: Leaflet, pins, location search
│   │   │   └── mechanics/         # Pluggable mechanic components
│   │   ├── hooks/                 # useWebSocket, useAuth, useCampaign, useSheet
│   │   ├── mechanics/             # Built-in mechanic plugins
│   │   │   ├── wild-magic/        # Ported from existing project
│   │   │   └── fear-tracker/      # Example second mechanic
│   │   ├── stores/                # Zustand stores
│   │   └── types/                 # TypeScript types
│   └── package.json
├── server/                        # Node.js backend
│   ├── src/
│   │   ├── routes/                # REST API routes
│   │   ├── services/              # Auth, dice, campaign, sheet
│   │   ├── ws/                    # WebSocket handlers
│   │   ├── mechanics/             # Server-side mechanic handlers
│   │   ├── models/                # Database queries
│   │   └── middleware/            # Auth, rate limiting, logging
│   ├── migrations/                # Database migrations
│   └── package.json
├── shared/                        # Shared types + utilities
│   ├── types.ts
│   ├── rules/                     # Dice logic, stat calculations
│   └── mechanic-interface.ts      # Plugin contract
├── docker-compose.yml
└── README.md
```

---

## 9. Open Questions

1. **State management?** Zustand (lightweight) vs Redux for multi-panel real-time state? Leaning Zustand — simpler API, smaller bundle, good middleware for WebSocket sync.
2. **Monorepo tooling?** Turborepo or Nx for client/server/shared packages? Or keep it simple with npm workspaces?
3. **Background transition?** Instant cut, crossfade, or both with a GM toggle?
4. **Offline support?** Local dice rolling + sync when reconnected, or require always-online? A VTT is inherently real-time — is offline worth the complexity?
5. **Testing strategy?** Vitest for unit/integration + Playwright for E2E? Or start lightweight with just Vitest?
6. **Accessibility baseline?** WCAG AA for character sheets and chat? How far to go in Phase 1?
7. **Map tile provider?** OpenStreetMap (free, no key) is the clear choice for MVP. Worth offering Google Maps as an option later for satellite view?

---

## 10. Immediate Next Step

Scaffold **Phase 1 MVP**: user auth + campaign CRUD + character sheet + server dice roller. This is the smallest thing that demonstrates the core value — shared character sheets with provably fair dice. Everything else builds on this foundation.

**Resolved decisions (no longer open):**

- **Hosting:** Render free tier (see §2.1). Fallback: home machine or Railway.
- **Dice animation:** CSS keyframe spin (~1 second), text-only fallback. No canvas or 3D physics.
- **Sheet conflict resolution:** Field-level last-write-wins with presence indicators and per-field undo (see §6).
