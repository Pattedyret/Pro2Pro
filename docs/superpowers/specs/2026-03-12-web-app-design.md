# Pro2Pro Web App — Design Spec

## Overview

A web frontend for the Pro2Pro CS2 connection game. Users sign in with Discord, play daily/random/custom puzzles, track streaks, earn points, and view server leaderboards. Deployed as a static React SPA on GitHub Pages, talking to an Express API embedded in the existing bot process.

## Architecture

**Approach A: Monolith** — Express embedded in the bot process, SQLite shared.

- **Frontend**: Vite + React + TypeScript + Tailwind CSS, deployed to GitHub Pages
- **Backend**: Express server added to the bot's Node.js process (`src/api/`)
- **Database**: SQLite (existing), extended with new tables
- **Auth**: Discord OAuth2 Authorization Code flow

```
GitHub Pages (static)          Bot Process (Node.js)
┌─────────────────┐           ┌──────────────────────┐
│  React SPA       │  ──API──▶│  Express Server       │
│  (Vite + Tailwind)│          │  Discord Bot          │
│                  │          │  SQLite DB            │
│                  │◀──JWT────│  Player Graph (memory) │
└─────────────────┘           └──────────────────────┘
```

## Database Schema Changes

### New Tables

```sql
CREATE TABLE web_sessions (
  id TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL,
  discord_username TEXT NOT NULL,
  discord_avatar TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_guilds (
  discord_user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  guild_name TEXT NOT NULL,
  guild_icon TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (discord_user_id, guild_id)
);

CREATE TABLE user_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_user_id TEXT NOT NULL,
  guild_id TEXT,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source TEXT NOT NULL,
  puzzle_id INTEGER,
  custom_game_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Existing Table Changes

- `user_attempts`: add `source TEXT DEFAULT 'bot'`
- `custom_game_attempts`: add `source TEXT DEFAULT 'bot'`
- `user_stats`: add `total_points INTEGER DEFAULT 0`

## Scoring System

| Event | Points |
|-------|--------|
| Completion | 100 |
| Optimal solve | +50 |
| Medium difficulty | +25 |
| Hard difficulty | +50 |
| Streak bonus | +10 per consecutive day (cap +100) |

Streaks = consecutive daily solves (any difficulty). Resets on a missed day.

## Auth Flow

1. Frontend redirects to Discord OAuth (`scope=identify+guilds`)
2. Discord redirects to `FRONTEND_URL/callback?code=...`
3. Frontend POSTs code to `POST /api/auth/discord`
4. API exchanges code for tokens, fetches user info + guilds from Discord
5. API creates `web_sessions` row + caches guilds in `user_guilds`
6. API returns JWT to frontend
7. Frontend stores JWT in localStorage, sends as `Authorization: Bearer <jwt>`

## API Endpoints

All prefixed with `/api/`. Auth-required endpoints check JWT middleware.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/discord | No | Exchange OAuth code for JWT |
| GET | /auth/me | Yes | Current user + stats |
| GET | /auth/guilds | Yes | User's guilds (bot-joined only) |
| GET | /puzzles/daily | No | Today's puzzle info |
| GET | /puzzles/daily/:number | No | Specific daily by number |
| GET | /puzzles/archive | Yes | All dailies with user completion status |
| POST | /games/start | Yes | Start game session (daily/random/custom) |
| POST | /games/:sessionId/guess | Yes | Submit a player guess |
| POST | /games/:sessionId/giveup | Yes | Give up |
| GET | /players/search?q=... | Yes | Search players |
| GET | /leaderboard/:guildId | Yes | Server leaderboard |
| GET | /leaderboard/:guildId/puzzle/:puzzleId | Yes | Per-puzzle results (spoiler-protected) |

### Spoiler Protection

`/leaderboard/:guildId/puzzle/:puzzleId` only returns other users' paths if the requesting user has completed or given up on that puzzle.

### Web Game Sessions

Stored in-memory with `web:userId:gameId` keys. Same `GameState` interface as bot. Expire after 1 hour of inactivity.

## Frontend

### Pages

| Route | Page | Description |
|-------|------|-------------|
| / | Landing | Hero + game mode cards + login CTA |
| /callback | OAuth | Handles Discord redirect |
| /daily | Today | Today's puzzle game board |
| /daily/:number | Past Daily | Play a missed daily |
| /archive | Archive | Calendar/grid of all dailies |
| /random | Random | Difficulty picker + game board |
| /custom | Custom | Player search + game board |
| /leaderboard | Leaderboard | Server picker + rankings |
| /profile | Profile | Stats, streaks, points |

### Components

- `GameBoard` — Shared game UI (search, path building, validation, completion)
- `PlayerSearch` — Debounced search input + result cards
- `PathDisplay` — Visual chain with team connections, animations
- `DifficultyPicker` — Easy/Medium/Hard selection cards
- `Navbar` — Navigation with auth state
- `Layout` — Page wrapper

### Design Direction

- Dark theme (deep navy/black) with subtle grid pattern
- Cyan and purple neon accents, glowing borders
- Glassmorphism cards with backdrop-blur
- Smooth transitions and micro-animations
- Monospace accent font for stats, clean sans-serif for text
- Mobile-first, responsive

## File Structure

```
src/api/
  server.ts
  auth.ts
  puzzles.ts
  games.ts
  players.ts
  leaderboard.ts
  middleware.ts
  webGameState.ts

web/
  src/
    main.tsx, App.tsx
    api/client.ts
    pages/ (Landing, Daily, Archive, Random, Custom, Leaderboard, Profile, Callback)
    components/ (GameBoard, PlayerSearch, PathDisplay, DifficultyPicker, Navbar, Layout)
    hooks/ (useAuth, useGame)
    styles/globals.css
  index.html, vite.config.ts, tailwind.config.ts, package.json
```

## Game Flow (Web)

1. User visits `/daily` → sees puzzle info (players, difficulty, optimal length)
2. Not logged in → "Sign in with Discord" CTA
3. Already completed → shows result + server leaderboard
4. Plays: search player → select → API validates → path updates
5. Bidirectional building (same as bot)
6. Completion → points awarded, celebration, leaderboard update
7. Give up → solution revealed, marked as done, no points

Random: difficulty picker → API generates pair → same game flow.
Custom: search both players → API creates game → same game flow.

## Constraints

- GitHub Pages = static only, no SSR
- Bot must be publicly accessible for API (domain, VPS, ngrok for dev)
- API URL configurable via environment variable
- SQLite single-writer — API and bot share the same process, no concurrency issues
