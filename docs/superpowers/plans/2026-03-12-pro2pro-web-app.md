# Pro2Pro Web App Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full web frontend for Pro2Pro with Discord auth, all game modes, points, streaks, and server leaderboards.

**Architecture:** Express API embedded in the existing bot process serves REST endpoints. React SPA on GitHub Pages consumes the API. SQLite shared between bot and API. Discord OAuth2 Authorization Code flow for auth.

**Tech Stack:** Express, cors, jsonwebtoken (backend additions). Vite, React 18, TypeScript, Tailwind CSS, React Router v6 (frontend). SQLite (existing).

**Spec:** `docs/superpowers/specs/2026-03-12-web-app-design.md`

---

## File Structure

### Backend (new files in `src/api/`)

| File | Responsibility |
|------|---------------|
| `src/api/server.ts` | Express app setup, CORS, mount routes |
| `src/api/middleware.ts` | JWT auth middleware, session validation |
| `src/api/auth.ts` | `POST /auth/discord`, `GET /auth/me`, `GET /auth/guilds` |
| `src/api/puzzles.ts` | `GET /puzzles/daily`, `GET /puzzles/daily/:number`, `GET /puzzles/archive` |
| `src/api/games.ts` | `POST /games/start`, `POST /games/:id/guess`, `POST /games/:id/giveup` |
| `src/api/players.ts` | `GET /players/search` |
| `src/api/leaderboard.ts` | `GET /leaderboard/:guildId`, `GET /leaderboard/:guildId/puzzle/:puzzleId` |
| `src/api/webGameState.ts` | In-memory web game sessions with auto-expiry |
| `src/api/points.ts` | Points calculation and ledger writes |

### Backend (modified files)

| File | Change |
|------|--------|
| `src/config.ts` | Add `apiPort`, `jwtSecret`, `discordClientSecret`, `frontendUrl` |
| `src/data/db.ts` | Add migrations for `web_sessions`, `user_guilds`, `user_points`, `source` columns |
| `src/index.ts` | Start Express server after bot login |
| `package.json` | Add `express`, `cors`, `jsonwebtoken` dependencies |

### Frontend (new `web/` directory)

| File | Responsibility |
|------|---------------|
| `web/package.json` | Vite + React + Tailwind deps |
| `web/vite.config.ts` | Vite config with base path for GitHub Pages |
| `web/tailwind.config.ts` | Custom theme (futuristic dark) |
| `web/index.html` | Entry HTML |
| `web/src/main.tsx` | React root mount |
| `web/src/App.tsx` | Router + auth context provider |
| `web/src/api/client.ts` | Fetch wrapper with JWT, base URL config |
| `web/src/hooks/useAuth.ts` | Auth state, login/logout, token management |
| `web/src/hooks/useGame.ts` | Game session state, guess/giveup actions |
| `web/src/context/AuthContext.tsx` | React context for auth state |
| `web/src/pages/Landing.tsx` | Hero, game mode cards, login CTA |
| `web/src/pages/Callback.tsx` | OAuth callback handler |
| `web/src/pages/Daily.tsx` | Today's puzzle + game board |
| `web/src/pages/PastDaily.tsx` | Past daily by number |
| `web/src/pages/Archive.tsx` | Calendar/grid of all dailies |
| `web/src/pages/Random.tsx` | Difficulty picker + game |
| `web/src/pages/Custom.tsx` | Player search + game |
| `web/src/pages/Leaderboard.tsx` | Server picker + rankings |
| `web/src/pages/Profile.tsx` | Stats, streaks, points |
| `web/src/components/Layout.tsx` | Page wrapper with Navbar |
| `web/src/components/Navbar.tsx` | Navigation + auth UI |
| `web/src/components/GameBoard.tsx` | Shared game UI for all modes |
| `web/src/components/PlayerSearch.tsx` | Debounced search + result cards |
| `web/src/components/PathDisplay.tsx` | Visual path chain |
| `web/src/components/DifficultyPicker.tsx` | Easy/Medium/Hard cards |
| `web/src/components/PuzzleCard.tsx` | Archive grid item |
| `web/src/components/ProtectedRoute.tsx` | Redirect to login if not authed |
| `web/src/styles/globals.css` | Tailwind base + custom utilities |

---

## Chunk 1: Backend Foundation

### Task 1: Install backend dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Express, CORS, JWT packages**

```bash
npm install express cors jsonwebtoken
npm install --save-dev @types/express @types/cors @types/jsonwebtoken
```

- [ ] **Step 2: Verify build still works**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add express, cors, jsonwebtoken dependencies"
```

---

### Task 2: Add API config values

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Add API config block to config.ts**

Add after the existing config entries, before `} as const`:

```typescript
// Web API
apiPort: parseInt(process.env.API_PORT || '3001', 10),
jwtSecret: process.env.JWT_SECRET || 'pro2pro-dev-secret-change-in-prod',
discordClientSecret: process.env.DISCORD_CLIENT_SECRET || '',
frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat: add web API config values"
```

---

### Task 3: Database migrations for web tables

**Files:**
- Modify: `src/data/db.ts`

- [ ] **Step 1: Add new table migrations at the end of `runMigrations`**

Add after the existing `idx_rosters_tournament` index creation:

```typescript
// Web sessions
db.exec(`
  CREATE TABLE IF NOT EXISTS web_sessions (
    id TEXT PRIMARY KEY,
    discord_user_id TEXT NOT NULL,
    discord_username TEXT NOT NULL,
    discord_avatar TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_guilds (
    discord_user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    guild_name TEXT NOT NULL,
    guild_icon TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (discord_user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS user_points (
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

  CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(discord_user_id);
  CREATE INDEX IF NOT EXISTS idx_user_points_guild ON user_points(guild_id);
  CREATE INDEX IF NOT EXISTS idx_web_sessions_user ON web_sessions(discord_user_id);
`);

// Add source column to user_attempts
try { db.exec(`ALTER TABLE user_attempts ADD COLUMN source TEXT DEFAULT 'bot'`); } catch (_) {}
// Add source column to custom_game_attempts
try { db.exec(`ALTER TABLE custom_game_attempts ADD COLUMN source TEXT DEFAULT 'bot'`); } catch (_) {}
// Add total_points to user_stats
try { db.exec(`ALTER TABLE user_stats ADD COLUMN total_points INTEGER DEFAULT 0`); } catch (_) {}
```

- [ ] **Step 2: Verify build and DB migration runs**

Run: `npx tsc --noEmit`
Then: `node -e "require('./dist/data/db').getDb(); console.log('OK')"`
Expected: No errors, "OK"

- [ ] **Step 3: Commit**

```bash
git add src/data/db.ts
git commit -m "feat: add web sessions, user guilds, points tables + source columns"
```

---

### Task 4: JWT auth middleware

**Files:**
- Create: `src/api/middleware.ts`

- [ ] **Step 1: Create the middleware file**

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDb } from '../data/db';

export interface AuthUser {
  userId: string;
  username: string;
  avatar: string | null;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    const db = getDb();
    const session = db.prepare('SELECT * FROM web_sessions WHERE id = ?').get(payload.sid) as any;

    if (!session || new Date(session.expires_at) < new Date()) {
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    req.user = {
      userId: session.discord_user_id,
      username: session.discord_username,
      avatar: session.discord_avatar,
      sessionId: session.id,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function authOptional(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    const db = getDb();
    const session = db.prepare('SELECT * FROM web_sessions WHERE id = ?').get(payload.sid) as any;
    if (session && new Date(session.expires_at) >= new Date()) {
      req.user = {
        userId: session.discord_user_id,
        username: session.discord_username,
        avatar: session.discord_avatar,
        sessionId: session.id,
      };
    }
  } catch {
    // Invalid token — proceed without auth
  }
  next();
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/api/middleware.ts
git commit -m "feat: add JWT auth middleware with required and optional variants"
```

---

### Task 5: Discord OAuth auth routes

**Files:**
- Create: `src/api/auth.ts`

- [ ] **Step 1: Create auth routes**

```typescript
import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { getDb } from '../data/db';
import { authRequired } from './middleware';
import { client } from '../bot/client';

const router = Router();

// POST /auth/discord — exchange OAuth code for JWT
router.post('/discord', async (req, res) => {
  const { code, redirect_uri } = req.body;
  if (!code) {
    res.status(400).json({ error: 'Missing code' });
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await axios.post('https://discord.com/api/v10/oauth2/token',
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.discordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect_uri || `${config.frontendUrl}/callback`,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Fetch user info
    const userRes = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { id: userId, username, avatar } = userRes.data;

    // Fetch user guilds
    const guildsRes = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const db = getDb();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Save session
    db.prepare(`
      INSERT OR REPLACE INTO web_sessions (id, discord_user_id, discord_username, discord_avatar, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, username, avatar, access_token, refresh_token ?? null, expiresAt);

    // Cache guilds (only ones the bot is in)
    const botGuildIds = new Set(client.guilds.cache.map(g => g.id));
    for (const guild of guildsRes.data) {
      if (botGuildIds.has(guild.id)) {
        db.prepare(`
          INSERT OR REPLACE INTO user_guilds (discord_user_id, guild_id, guild_name, guild_icon, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).run(userId, guild.id, guild.name, guild.icon ?? null);
      }
    }

    // Create JWT
    const token = jwt.sign({ sid: sessionId, uid: userId }, config.jwtSecret, { expiresIn: '7d' });

    res.json({ token, user: { id: userId, username, avatar } });
  } catch (err: any) {
    console.error('[API] OAuth error:', err.response?.data ?? err.message);
    res.status(500).json({ error: 'OAuth exchange failed' });
  }
});

// GET /auth/me — current user info + stats
router.get('/me', authRequired, (req, res) => {
  const db = getDb();
  const stats = db.prepare('SELECT * FROM user_stats WHERE discord_user_id = ?').get(req.user!.userId) as any;
  const totalPoints = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM user_points WHERE discord_user_id = ?').get(req.user!.userId) as any;

  res.json({
    user: {
      id: req.user!.userId,
      username: req.user!.username,
      avatar: req.user!.avatar,
    },
    stats: stats ?? { games_played: 0, games_won: 0, current_streak: 0, max_streak: 0, avg_path_length: 0, total_points: 0 },
    totalPoints: totalPoints?.total ?? 0,
  });
});

// GET /auth/guilds — user's guilds where bot is present
router.get('/guilds', authRequired, (req, res) => {
  const db = getDb();
  const guilds = db.prepare('SELECT guild_id, guild_name, guild_icon FROM user_guilds WHERE discord_user_id = ?').all(req.user!.userId);
  res.json({ guilds });
});

export default router;
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/api/auth.ts
git commit -m "feat: add Discord OAuth auth routes (login, me, guilds)"
```

---

### Task 6: Points calculation module

**Files:**
- Create: `src/api/points.ts`

- [ ] **Step 1: Create points module**

```typescript
import { getDb } from '../data/db';

interface PointsEvent {
  userId: string;
  guildId?: string | null;
  puzzleId?: number;
  customGameId?: number;
  source: 'bot' | 'web';
}

interface PointsResult {
  total: number;
  breakdown: { reason: string; points: number }[];
}

export function awardCompletionPoints(
  event: PointsEvent & { isOptimal: boolean; difficulty?: string; currentStreak: number }
): PointsResult {
  const breakdown: { reason: string; points: number }[] = [];
  const db = getDb();

  // Base completion
  breakdown.push({ reason: 'completion', points: 100 });

  // Optimal bonus
  if (event.isOptimal) {
    breakdown.push({ reason: 'optimal', points: 50 });
  }

  // Difficulty bonus
  if (event.difficulty === 'medium' || event.difficulty === 'hard') {
    const diffPoints = event.difficulty === 'hard' ? 50 : 25;
    breakdown.push({ reason: 'difficulty', points: diffPoints });
  }

  // Streak bonus (10 per consecutive day, cap 100)
  if (event.currentStreak > 0) {
    const streakPoints = Math.min(event.currentStreak * 10, 100);
    breakdown.push({ reason: 'streak', points: streakPoints });
  }

  const total = breakdown.reduce((sum, b) => sum + b.points, 0);

  // Write to ledger
  const insert = db.prepare(`
    INSERT INTO user_points (discord_user_id, guild_id, points, reason, source, puzzle_id, custom_game_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const b of breakdown) {
    insert.run(event.userId, event.guildId ?? null, b.points, b.reason, event.source, event.puzzleId ?? null, event.customGameId ?? null);
  }

  // Update total in user_stats
  db.prepare('UPDATE user_stats SET total_points = total_points + ? WHERE discord_user_id = ?').run(total, event.userId);

  return { total, breakdown };
}

export function getUserTotalPoints(userId: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM user_points WHERE discord_user_id = ?').get(userId) as any;
  return row?.total ?? 0;
}

export function getGuildLeaderboardPoints(guildId: string, limit = 20): { discord_user_id: string; total_points: number; rank: number }[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT discord_user_id, COALESCE(SUM(points), 0) as total_points
    FROM user_points WHERE guild_id = ?
    GROUP BY discord_user_id
    ORDER BY total_points DESC
    LIMIT ?
  `).all(guildId, limit) as any[];

  return rows.map((r: any, i: number) => ({ ...r, rank: i + 1 }));
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/api/points.ts
git commit -m "feat: add points calculation and ledger module"
```

---

### Task 7: Web game state manager

**Files:**
- Create: `src/api/webGameState.ts`

- [ ] **Step 1: Create web game state with auto-expiry**

```typescript
import { GameState } from '../bot/interactions/gameState';

interface WebGameSession {
  game: GameState;
  userId: string;
  lastActivity: number;
}

const sessions = new Map<string, WebGameSession>();
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

export function createWebSession(sessionId: string, userId: string, game: GameState): void {
  sessions.set(sessionId, { game, userId, lastActivity: Date.now() });
}

export function getWebSession(sessionId: string, userId: string): GameState | null {
  const session = sessions.get(sessionId);
  if (!session || session.userId !== userId) return null;
  if (Date.now() - session.lastActivity > SESSION_TTL) {
    sessions.delete(sessionId);
    return null;
  }
  session.lastActivity = Date.now();
  return session.game;
}

export function deleteWebSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// Clean expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000);
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/api/webGameState.ts
git commit -m "feat: add web game session manager with auto-expiry"
```

---

### Task 8: Puzzle API routes

**Files:**
- Create: `src/api/puzzles.ts`

- [ ] **Step 1: Create puzzle routes**

```typescript
import { Router } from 'express';
import { getDb } from '../data/db';
import { getTodayPuzzle, getPuzzleByNumber } from '../data/models/puzzle';
import { playerGraph } from '../game/graph';
import { authRequired, authOptional } from './middleware';

const router = Router();

function formatPuzzleResponse(puzzle: any, userId?: string) {
  const startPlayer = playerGraph.getPlayer(puzzle.start_player_id);
  const endPlayer = playerGraph.getPlayer(puzzle.end_player_id);
  const startTeams = playerGraph.getPlayerFullTeamNames(puzzle.start_player_id, 2);
  const endTeams = playerGraph.getPlayerFullTeamNames(puzzle.end_player_id, 2);

  const response: any = {
    id: puzzle.id,
    puzzleNumber: puzzle.puzzle_number,
    date: puzzle.date,
    difficulty: puzzle.difficulty,
    optimalPathLength: puzzle.optimal_path_length,
    numValidPaths: puzzle.num_valid_paths,
    startPlayer: {
      id: puzzle.start_player_id,
      name: startPlayer?.name ?? '???',
      nationality: startPlayer?.nationality,
      imageUrl: startPlayer?.imageUrl,
      teams: startTeams,
    },
    endPlayer: {
      id: puzzle.end_player_id,
      name: endPlayer?.name ?? '???',
      nationality: endPlayer?.nationality,
      imageUrl: endPlayer?.imageUrl,
      teams: endTeams,
    },
  };

  // If user provided, add their attempt status
  if (userId) {
    const db = getDb();
    const attempt = db.prepare(
      'SELECT path_length, is_optimal, completed_at FROM user_attempts WHERE puzzle_id = ? AND discord_user_id = ?'
    ).get(puzzle.id, userId) as any;

    response.userAttempt = attempt ? {
      pathLength: attempt.path_length,
      isOptimal: !!attempt.is_optimal,
      completedAt: attempt.completed_at,
    } : null;
  }

  return response;
}

// GET /puzzles/daily — today's puzzle
router.get('/daily', authOptional, (req, res) => {
  const puzzle = getTodayPuzzle();
  if (!puzzle) {
    res.status(404).json({ error: 'No daily puzzle today' });
    return;
  }
  res.json(formatPuzzleResponse(puzzle, req.user?.userId));
});

// GET /puzzles/daily/:number — specific daily by number
router.get('/daily/:number', authOptional, (req, res) => {
  const num = parseInt(req.params.number);
  if (isNaN(num)) {
    res.status(400).json({ error: 'Invalid puzzle number' });
    return;
  }

  const puzzle = getPuzzleByNumber(num);
  if (!puzzle) {
    res.status(404).json({ error: 'Puzzle not found' });
    return;
  }

  res.json(formatPuzzleResponse(puzzle, req.user?.userId));
});

// GET /puzzles/archive — all dailies with completion status
router.get('/archive', authRequired, (req, res) => {
  const db = getDb();
  const puzzles = db.prepare('SELECT * FROM daily_puzzles ORDER BY puzzle_number DESC').all() as any[];

  const result = puzzles.map(p => {
    const attempt = db.prepare(
      'SELECT path_length, is_optimal FROM user_attempts WHERE puzzle_id = ? AND discord_user_id = ?'
    ).get(p.id, req.user!.userId) as any;

    return {
      puzzleNumber: p.puzzle_number,
      date: p.date,
      difficulty: p.difficulty,
      optimalPathLength: p.optimal_path_length,
      status: attempt ? (attempt.is_optimal ? 'optimal' : 'completed') : 'available',
    };
  });

  res.json({ puzzles: result });
});

export default router;
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/api/puzzles.ts
git commit -m "feat: add puzzle API routes (daily, by number, archive)"
```

---

### Task 9: Player search route

**Files:**
- Create: `src/api/players.ts`

- [ ] **Step 1: Create player search route**

```typescript
import { Router } from 'express';
import { playerGraph } from '../game/graph';
import { authRequired } from './middleware';

const router = Router();

// GET /players/search?q=...
router.get('/search', authRequired, (req, res) => {
  const query = (req.query.q as string ?? '').trim();
  if (query.length < 1) {
    res.json({ players: [] });
    return;
  }

  let results = playerGraph.searchPlayers(query, 15);

  // Fuzzy fallback
  if (results.length === 0) {
    results = playerGraph.fuzzySearchPlayers(query, 10);
  }

  const players = results.map(p => ({
    id: p.id,
    name: p.name,
    nationality: p.nationality,
    imageUrl: p.imageUrl,
    teams: playerGraph.getPlayerTeams(p.id).slice(0, 3),
    fullTeamNames: playerGraph.getPlayerFullTeamNames(p.id, 2),
  }));

  res.json({ players, fuzzy: results.length > 0 && playerGraph.searchPlayers(query, 1).length === 0 });
});

export default router;
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/api/players.ts
git commit -m "feat: add player search API with fuzzy fallback"
```

---

### Task 10: Game session routes (start, guess, giveup)

**Files:**
- Create: `src/api/games.ts`

- [ ] **Step 1: Create game routes**

```typescript
import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../data/db';
import { playerGraph } from '../game/graph';
import { findShortestPath, countShortestPaths, findAllShortestPaths } from '../game/pathfinder';
import { validateLink } from '../game/validator';
import { getPuzzleByNumber, getTodayPuzzle } from '../data/models/puzzle';
import { getUserAttempt, saveUserAttempt, getUserStats } from '../data/models/userStats';
import { authRequired } from './middleware';
import { createWebSession, getWebSession, deleteWebSession } from './webGameState';
import { awardCompletionPoints } from './points';
import { config } from '../config';
import { getFullPath } from '../bot/interactions/gameState';

const router = Router();

// POST /games/start — start a game session
router.post('/start', authRequired, async (req, res) => {
  const { mode, puzzleNumber, difficulty, startPlayerId, endPlayerId } = req.body;
  const userId = req.user!.userId;

  if (mode === 'daily') {
    const puzzle = puzzleNumber ? getPuzzleByNumber(puzzleNumber) : getTodayPuzzle();
    if (!puzzle) {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }

    // Check if already completed
    const existing = getUserAttempt(puzzle.id, userId);
    if (existing) {
      res.status(409).json({ error: 'Already completed this puzzle', attempt: existing });
      return;
    }

    const sessionId = crypto.randomUUID();
    createWebSession(sessionId, userId, {
      puzzleId: puzzle.id,
      type: 'daily',
      forwardPath: [puzzle.start_player_id],
      backwardPath: [puzzle.end_player_id],
      searchDirection: 'forward',
      startPlayerId: puzzle.start_player_id,
      endPlayerId: puzzle.end_player_id,
    });

    res.json({ sessionId, puzzleId: puzzle.id });

  } else if (mode === 'random') {
    const tier = config.randomDifficulty[(difficulty ?? 'medium') as keyof typeof config.randomDifficulty];
    if (!tier) {
      res.status(400).json({ error: 'Invalid difficulty' });
      return;
    }

    // Pick pool
    let pool: number[];
    let secondPool: number[] | null = null;
    switch (tier.pool) {
      case 'famous':
        pool = playerGraph.getFamousPlayerIds();
        if (pool.length < 20) pool = playerGraph.getNotablePlayerIds();
        break;
      case 'notable':
        pool = playerGraph.getFamousPlayerIds();
        secondPool = playerGraph.getNotablePlayerIds();
        if (pool.length < 10) pool = playerGraph.getNotablePlayerIds();
        if (secondPool.length < 20) secondPool = playerGraph.getConnectedPlayerIds();
        break;
      case 'connected':
        pool = playerGraph.getConnectedPlayerIds();
        break;
    }

    const maxAttempts = difficulty === 'hard' ? 500 : 200;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let startId: number, endId: number;
      if (secondPool) {
        const swap = Math.random() < 0.5;
        const poolA = swap ? secondPool : pool;
        const poolB = swap ? pool : secondPool;
        startId = poolA[Math.floor(Math.random() * poolA.length)];
        endId = poolB[Math.floor(Math.random() * poolB.length)];
      } else {
        startId = pool[Math.floor(Math.random() * pool.length)];
        endId = pool[Math.floor(Math.random() * pool.length)];
      }
      if (startId === endId) continue;

      const result = findShortestPath(startId, endId);
      if (!result || result.length < tier.minPath || result.length > tier.maxPath) continue;

      const numPaths = countShortestPaths(startId, endId);
      if (numPaths < tier.minPaths) continue;

      // Save to DB
      const db = getDb();
      const insertResult = db.prepare(`
        INSERT INTO custom_games (discord_user_id, guild_id, channel_id, start_player_id, end_player_id, optimal_path_length, num_valid_paths, is_feasible)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(userId, '', 'web', startId, endId, result.length, numPaths);

      const gameId = Number(insertResult.lastInsertRowid);
      const sessionId = crypto.randomUUID();

      createWebSession(sessionId, userId, {
        puzzleId: gameId,
        type: 'custom',
        forwardPath: [startId],
        backwardPath: [endId],
        searchDirection: 'forward',
        startPlayerId: startId,
        endPlayerId: endId,
      });

      const startPlayer = playerGraph.getPlayer(startId);
      const endPlayer = playerGraph.getPlayer(endId);

      res.json({
        sessionId,
        gameId,
        difficulty: difficulty ?? 'medium',
        optimalPathLength: result.length,
        numValidPaths: numPaths,
        startPlayer: { id: startId, name: startPlayer?.name, nationality: startPlayer?.nationality, imageUrl: startPlayer?.imageUrl, teams: playerGraph.getPlayerFullTeamNames(startId, 2) },
        endPlayer: { id: endId, name: endPlayer?.name, nationality: endPlayer?.nationality, imageUrl: endPlayer?.imageUrl, teams: playerGraph.getPlayerFullTeamNames(endId, 2) },
      });
      return;
    }

    res.status(500).json({ error: 'Could not find a valid random pair. Try again.' });

  } else if (mode === 'custom') {
    if (!startPlayerId || !endPlayerId) {
      res.status(400).json({ error: 'Missing startPlayerId or endPlayerId' });
      return;
    }

    const p1 = playerGraph.getPlayer(startPlayerId);
    const p2 = playerGraph.getPlayer(endPlayerId);
    if (!p1 || !p2) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    const result = findShortestPath(startPlayerId, endPlayerId);
    if (!result) {
      res.status(400).json({ error: 'No connection between these players' });
      return;
    }

    const numPaths = countShortestPaths(startPlayerId, endPlayerId);
    const db = getDb();
    const insertResult = db.prepare(`
      INSERT INTO custom_games (discord_user_id, guild_id, channel_id, start_player_id, end_player_id, optimal_path_length, num_valid_paths, is_feasible)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(userId, '', 'web', startPlayerId, endPlayerId, result.length, numPaths);

    const gameId = Number(insertResult.lastInsertRowid);
    const sessionId = crypto.randomUUID();

    createWebSession(sessionId, userId, {
      puzzleId: gameId,
      type: 'custom',
      forwardPath: [startPlayerId],
      backwardPath: [endPlayerId],
      searchDirection: 'forward',
      startPlayerId: startPlayerId,
      endPlayerId: endPlayerId,
    });

    res.json({
      sessionId,
      gameId,
      optimalPathLength: result.length,
      numValidPaths: numPaths,
      startPlayer: { id: startPlayerId, name: p1.name, nationality: p1.nationality, imageUrl: p1.imageUrl, teams: playerGraph.getPlayerFullTeamNames(startPlayerId, 2) },
      endPlayer: { id: endPlayerId, name: p2.name, nationality: p2.nationality, imageUrl: p2.imageUrl, teams: playerGraph.getPlayerFullTeamNames(endPlayerId, 2) },
    });
  } else {
    res.status(400).json({ error: 'Invalid mode. Use: daily, random, custom' });
  }
});

// POST /games/:sessionId/guess — submit a guess
router.post('/:sessionId/guess', authRequired, (req, res) => {
  const { sessionId } = req.params;
  const { playerId, direction } = req.body;
  const userId = req.user!.userId;

  const game = getWebSession(sessionId, userId);
  if (!game) {
    res.status(404).json({ error: 'Game session not found or expired' });
    return;
  }

  const dir = direction === 'backward' ? 'backward' : 'forward';
  const chain = dir === 'forward' ? game.forwardPath : game.backwardPath;
  const lastPlayerId = chain[chain.length - 1];

  const validation = validateLink(lastPlayerId, playerId);
  if (!validation.valid) {
    const fromName = playerGraph.getPlayer(lastPlayerId)?.name ?? '???';
    const toName = playerGraph.getPlayer(playerId)?.name ?? '???';
    res.json({ valid: false, error: `${fromName} and ${toName} never shared a team` });
    return;
  }

  // Check duplicates
  if (game.forwardPath.includes(playerId) || game.backwardPath.includes(playerId)) {
    res.json({ valid: false, error: `${playerGraph.getPlayer(playerId)?.name} is already in your path` });
    return;
  }

  // Add to chain
  if (dir === 'forward') game.forwardPath.push(playerId);
  else game.backwardPath.push(playerId);

  const teamNames = validation.sharedTeams.map(t => t.teamAcronym ?? t.teamName);

  // Check completion
  let isComplete = false;
  if (dir === 'forward' && playerId === game.endPlayerId) isComplete = true;
  else if (dir === 'backward' && playerId === game.startPlayerId) isComplete = true;

  if (!isComplete) {
    const fwdTip = game.forwardPath[game.forwardPath.length - 1];
    const bwdTip = game.backwardPath[game.backwardPath.length - 1];
    if (playerGraph.areConnected(fwdTip, bwdTip)) isComplete = true;
  }

  if (isComplete) {
    const fullPath = getFullPath(game);
    const pathLength = fullPath.length - 1;
    let optimalLength: number;
    let difficulty: string | undefined;

    if (game.type === 'daily') {
      const puzzle = require('../data/models/puzzle').getPuzzleById(game.puzzleId);
      optimalLength = puzzle?.optimal_path_length ?? pathLength;
      difficulty = puzzle?.difficulty;

      saveUserAttempt({
        puzzleId: game.puzzleId,
        userId,
        guildId: null,
        path: fullPath,
        pathLength,
        isValid: true,
        isOptimal: pathLength === optimalLength,
      });
    } else {
      const shortest = findShortestPath(game.startPlayerId, game.endPlayerId);
      optimalLength = shortest?.length ?? pathLength;
    }

    const isOptimal = pathLength === optimalLength;
    const stats = getUserStats(userId);
    const points = awardCompletionPoints({
      userId,
      source: 'web',
      puzzleId: game.type === 'daily' ? game.puzzleId : undefined,
      customGameId: game.type === 'custom' ? game.puzzleId : undefined,
      isOptimal,
      difficulty,
      currentStreak: stats.current_streak,
    });

    deleteWebSession(sessionId);

    const pathNames = fullPath.map(id => ({
      id,
      name: playerGraph.getPlayer(id)?.name ?? '???',
      nationality: playerGraph.getPlayer(id)?.nationality,
    }));

    res.json({
      valid: true,
      complete: true,
      teams: teamNames,
      path: pathNames,
      pathLength,
      optimalLength,
      isOptimal,
      points,
    });
    return;
  }

  const player = playerGraph.getPlayer(playerId);
  res.json({
    valid: true,
    complete: false,
    teams: teamNames,
    player: { id: playerId, name: player?.name, nationality: player?.nationality },
    forwardPath: game.forwardPath.map(id => ({ id, name: playerGraph.getPlayer(id)?.name })),
    backwardPath: game.backwardPath.map(id => ({ id, name: playerGraph.getPlayer(id)?.name })),
  });
});

// POST /games/:sessionId/giveup
router.post('/:sessionId/giveup', authRequired, (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user!.userId;

  const game = getWebSession(sessionId, userId);
  if (!game) {
    res.status(404).json({ error: 'Game session not found or expired' });
    return;
  }

  const allPaths = findAllShortestPaths(game.startPlayerId, game.endPlayerId, 3);
  deleteWebSession(sessionId);

  // Mark daily as attempted (given up) so they can't replay
  if (game.type === 'daily') {
    const db = getDb();
    try {
      db.prepare(`
        INSERT OR IGNORE INTO user_attempts (puzzle_id, discord_user_id, path, path_length, is_valid, is_optimal, source)
        VALUES (?, ?, '[]', 0, 0, 0, 'web')
      `).run(game.puzzleId, userId);
    } catch {}
  }

  const solutions = allPaths.map(path =>
    path.map(id => ({
      id,
      name: playerGraph.getPlayer(id)?.name ?? '???',
      nationality: playerGraph.getPlayer(id)?.nationality,
    }))
  );

  res.json({
    solutions,
    optimalLength: allPaths.length > 0 ? allPaths[0].length - 1 : null,
  });
});

export default router;
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/api/games.ts
git commit -m "feat: add game session routes (start, guess, giveup) for all modes"
```

---

### Task 11: Leaderboard routes

**Files:**
- Create: `src/api/leaderboard.ts`

- [ ] **Step 1: Create leaderboard routes**

```typescript
import { Router } from 'express';
import { getDb } from '../data/db';
import { authRequired } from './middleware';
import { getGuildLeaderboardPoints } from './points';

const router = Router();

// GET /leaderboard/:guildId — server leaderboard by points
router.get('/:guildId', authRequired, (req, res) => {
  const { guildId } = req.params;

  // Verify user belongs to this guild
  const db = getDb();
  const membership = db.prepare(
    'SELECT 1 FROM user_guilds WHERE discord_user_id = ? AND guild_id = ?'
  ).get(req.user!.userId, guildId);

  if (!membership) {
    res.status(403).json({ error: 'Not a member of this server' });
    return;
  }

  const pointsLeaderboard = getGuildLeaderboardPoints(guildId, 50);

  // Enrich with stats
  const enriched = pointsLeaderboard.map(entry => {
    const stats = db.prepare('SELECT * FROM user_stats WHERE discord_user_id = ?').get(entry.discord_user_id) as any;
    const guilds = db.prepare('SELECT discord_username FROM web_sessions WHERE discord_user_id = ? ORDER BY created_at DESC LIMIT 1').get(entry.discord_user_id) as any;

    return {
      rank: entry.rank,
      userId: entry.discord_user_id,
      username: guilds?.discord_username ?? 'Unknown',
      totalPoints: entry.total_points,
      gamesPlayed: stats?.games_played ?? 0,
      gamesWon: stats?.games_won ?? 0,
      currentStreak: stats?.current_streak ?? 0,
      maxStreak: stats?.max_streak ?? 0,
      avgPathLength: stats?.avg_path_length ?? 0,
    };
  });

  res.json({ leaderboard: enriched });
});

// GET /leaderboard/:guildId/puzzle/:puzzleId — per-puzzle (spoiler protected)
router.get('/:guildId/puzzle/:puzzleId', authRequired, (req, res) => {
  const { guildId, puzzleId } = req.params;
  const userId = req.user!.userId;
  const db = getDb();

  // Check if user has completed this puzzle
  const userAttempt = db.prepare(
    'SELECT * FROM user_attempts WHERE puzzle_id = ? AND discord_user_id = ?'
  ).get(parseInt(puzzleId), userId) as any;

  if (!userAttempt) {
    res.json({ spoilerProtected: true, message: 'Complete this puzzle first to see others\' results' });
    return;
  }

  // Get all attempts for this puzzle in this guild
  const attempts = db.prepare(`
    SELECT ua.discord_user_id, ua.path_length, ua.is_optimal, ua.completed_at,
           ws.discord_username
    FROM user_attempts ua
    LEFT JOIN web_sessions ws ON ws.discord_user_id = ua.discord_user_id
    WHERE ua.puzzle_id = ? AND ua.guild_id = ?
    ORDER BY ua.is_optimal DESC, ua.path_length ASC, ua.completed_at ASC
  `).all(parseInt(puzzleId), guildId) as any[];

  res.json({
    spoilerProtected: false,
    userAttempt: {
      pathLength: userAttempt.path_length,
      isOptimal: !!userAttempt.is_optimal,
    },
    attempts: attempts.map((a: any, i: number) => ({
      rank: i + 1,
      userId: a.discord_user_id,
      username: a.discord_username ?? 'Unknown',
      pathLength: a.path_length,
      isOptimal: !!a.is_optimal,
      completedAt: a.completed_at,
    })),
  });
});

export default router;
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/api/leaderboard.ts
git commit -m "feat: add leaderboard routes with spoiler protection"
```

---

### Task 12: Express server setup and mount

**Files:**
- Create: `src/api/server.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create Express server**

```typescript
import express from 'express';
import cors from 'cors';
import { config } from '../config';
import authRoutes from './auth';
import puzzleRoutes from './puzzles';
import gameRoutes from './games';
import playerRoutes from './players';
import leaderboardRoutes from './leaderboard';

export function startApiServer(): void {
  const app = express();

  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
  }));
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/puzzles', puzzleRoutes);
  app.use('/api/games', gameRoutes);
  app.use('/api/players', playerRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);

  app.listen(config.apiPort, () => {
    console.log(`[API] Server running on port ${config.apiPort}`);
  });
}
```

- [ ] **Step 2: Add API server start to index.ts**

In `src/index.ts`, add import at the top:

```typescript
import { startApiServer } from './api/server';
```

Then inside the `client.on('ready', ...)` callback, after `startScheduler();`, add:

```typescript
// Start web API server
startApiServer();
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Test server starts**

Run: `npx tsc && node dist/index.js`
Expected: See `[API] Server running on port 3001` in output

- [ ] **Step 5: Test health endpoint**

Run: `curl http://localhost:3001/api/health`
Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 6: Commit**

```bash
git add src/api/server.ts src/index.ts
git commit -m "feat: add Express API server with all routes mounted"
```

---

## Chunk 2: Frontend Foundation

### Task 13: Scaffold React + Vite + Tailwind project

**Files:**
- Create: `web/` directory with full Vite + React + Tailwind setup

- [ ] **Step 1: Create the Vite project**

```bash
cd /Users/pattedyr/Documents/GitHub/Pro2Pro
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom
```

- [ ] **Step 2: Configure Tailwind**

Replace `web/src/index.css` with:

```css
@import "tailwindcss";
```

Add Tailwind plugin to `web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/Pro2Pro/',
  server: {
    port: 5173,
  },
})
```

- [ ] **Step 3: Add GitHub Pages deploy script to web/package.json**

Add to scripts:

```json
"deploy": "npm run build && npx gh-pages -d dist"
```

And install gh-pages:

```bash
npm install -D gh-pages
```

- [ ] **Step 4: Verify it runs**

```bash
cd web && npm run dev
```

Expected: Dev server starts on http://localhost:5173

- [ ] **Step 5: Commit**

```bash
cd /Users/pattedyr/Documents/GitHub/Pro2Pro
git add web/
git commit -m "feat: scaffold React + Vite + Tailwind frontend"
```

---

### Task 14: API client module

**Files:**
- Create: `web/src/api/client.ts`

- [ ] **Step 1: Create the API client**

```typescript
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken(): string | null {
  return localStorage.getItem('pro2pro_token');
}

export function setToken(token: string): void {
  localStorage.setItem('pro2pro_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('pro2pro_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/Pro2Pro/';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (code: string, redirectUri: string) =>
    apiFetch<{ token: string; user: { id: string; username: string; avatar: string } }>('/auth/discord', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    }),
  me: () => apiFetch<{ user: any; stats: any; totalPoints: number }>('/auth/me'),
  guilds: () => apiFetch<{ guilds: any[] }>('/auth/guilds'),

  // Puzzles
  dailyPuzzle: () => apiFetch<any>('/puzzles/daily'),
  puzzleByNumber: (num: number) => apiFetch<any>(`/puzzles/daily/${num}`),
  archive: () => apiFetch<{ puzzles: any[] }>('/puzzles/archive'),

  // Games
  startGame: (body: { mode: string; puzzleNumber?: number; difficulty?: string; startPlayerId?: number; endPlayerId?: number }) =>
    apiFetch<any>('/games/start', { method: 'POST', body: JSON.stringify(body) }),
  guess: (sessionId: string, playerId: number, direction: 'forward' | 'backward') =>
    apiFetch<any>(`/games/${sessionId}/guess`, { method: 'POST', body: JSON.stringify({ playerId, direction }) }),
  giveUp: (sessionId: string) =>
    apiFetch<any>(`/games/${sessionId}/giveup`, { method: 'POST' }),

  // Players
  searchPlayers: (q: string) => apiFetch<{ players: any[]; fuzzy: boolean }>(`/players/search?q=${encodeURIComponent(q)}`),

  // Leaderboard
  leaderboard: (guildId: string) => apiFetch<{ leaderboard: any[] }>(`/leaderboard/${guildId}`),
  puzzleLeaderboard: (guildId: string, puzzleId: number) =>
    apiFetch<any>(`/leaderboard/${guildId}/puzzle/${puzzleId}`),
};
```

- [ ] **Step 2: Commit**

```bash
git add web/src/api/client.ts
git commit -m "feat: add API client with JWT auth and typed endpoints"
```

---

### Task 15: Auth context and hook

**Files:**
- Create: `web/src/context/AuthContext.tsx`
- Create: `web/src/hooks/useAuth.ts`

- [ ] **Step 1: Create AuthContext**

```tsx
import { createContext, useState, useEffect, ReactNode } from 'react';
import { api, setToken, clearToken, isAuthenticated } from '../api/client';

interface User {
  id: string;
  username: string;
  avatar: string | null;
}

interface AuthState {
  user: User | null;
  stats: any;
  totalPoints: number;
  loading: boolean;
  loggedIn: boolean;
  login: (code: string, redirectUri: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  user: null, stats: null, totalPoints: 0, loading: true, loggedIn: false,
  login: async () => {}, logout: () => {}, refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.me();
      setUser(data.user);
      setStats(data.stats);
      setTotalPoints(data.totalPoints);
    } catch {
      setUser(null);
      clearToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (code: string, redirectUri: string) => {
    const data = await api.login(code, redirectUri);
    setToken(data.token);
    setUser(data.user);
    await refresh();
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setStats(null);
    setTotalPoints(0);
  };

  return (
    <AuthContext.Provider value={{ user, stats, totalPoints, loading, loggedIn: !!user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Create useAuth hook**

```typescript
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/context/AuthContext.tsx web/src/hooks/useAuth.ts
git commit -m "feat: add auth context and useAuth hook"
```

---

### Task 16: useGame hook

**Files:**
- Create: `web/src/hooks/useGame.ts`

- [ ] **Step 1: Create useGame hook**

```typescript
import { useState, useCallback } from 'react';
import { api } from '../api/client';

interface Player {
  id: number;
  name: string;
  nationality?: string;
}

interface GameSession {
  sessionId: string;
  forwardPath: Player[];
  backwardPath: Player[];
  complete: boolean;
  givenUp: boolean;
  result: any | null;
  solutions: any[] | null;
  error: string | null;
}

export function useGame() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);

  const startGame = useCallback(async (opts: { mode: string; puzzleNumber?: number; difficulty?: string; startPlayerId?: number; endPlayerId?: number }) => {
    setLoading(true);
    try {
      const data = await api.startGame(opts);
      setSession({
        sessionId: data.sessionId,
        forwardPath: [data.startPlayer ?? { id: 0, name: '?' }],
        backwardPath: [data.endPlayer ?? { id: 0, name: '?' }],
        complete: false,
        givenUp: false,
        result: null,
        solutions: null,
        error: null,
      });
      return data;
    } catch (err: any) {
      setSession(prev => prev ? { ...prev, error: err.message } : null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const guess = useCallback(async (playerId: number, direction: 'forward' | 'backward') => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await api.guess(session.sessionId, playerId, direction);
      if (!data.valid) {
        setSession(prev => prev ? { ...prev, error: data.error } : null);
        return data;
      }
      if (data.complete) {
        setSession(prev => prev ? { ...prev, complete: true, result: data, error: null } : null);
      } else {
        setSession(prev => prev ? {
          ...prev,
          forwardPath: data.forwardPath,
          backwardPath: data.backwardPath,
          error: null,
        } : null);
      }
      return data;
    } finally {
      setLoading(false);
    }
  }, [session]);

  const giveUp = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await api.giveUp(session.sessionId);
      setSession(prev => prev ? { ...prev, givenUp: true, solutions: data.solutions, error: null } : null);
      return data;
    } finally {
      setLoading(false);
    }
  }, [session]);

  const reset = useCallback(() => setSession(null), []);

  return { session, loading, startGame, guess, giveUp, reset };
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/hooks/useGame.ts
git commit -m "feat: add useGame hook for game session management"
```

---

### Task 17: Layout, Navbar, and ProtectedRoute components

**Files:**
- Create: `web/src/components/Layout.tsx`
- Create: `web/src/components/Navbar.tsx`
- Create: `web/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: Create Navbar**

```tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '1480857828091625534';
const REDIRECT_URI = `${window.location.origin}/Pro2Pro/callback`;
const DISCORD_AUTH_URL = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify+guilds`;

export function Navbar() {
  const { user, loggedIn, logout, totalPoints } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-cyan-500/20 bg-black/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          Pro2Pro
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-gray-300">
          <Link to="/daily" className="hover:text-cyan-400 transition-colors">Daily</Link>
          <Link to="/archive" className="hover:text-cyan-400 transition-colors">Archive</Link>
          <Link to="/random" className="hover:text-cyan-400 transition-colors">Random</Link>
          <Link to="/custom" className="hover:text-cyan-400 transition-colors">Custom</Link>
          <Link to="/leaderboard" className="hover:text-cyan-400 transition-colors">Leaderboard</Link>
        </div>

        <div className="flex items-center gap-3">
          {loggedIn ? (
            <>
              <span className="text-xs text-cyan-400 font-mono">{totalPoints} pts</span>
              <Link to="/profile" className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors">
                {user?.avatar && (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`}
                    alt=""
                    className="w-7 h-7 rounded-full ring-1 ring-cyan-500/50"
                  />
                )}
                <span>{user?.username}</span>
              </Link>
              <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                Logout
              </button>
            </>
          ) : (
            <a
              href={DISCORD_AUTH_URL}
              className="px-4 py-1.5 text-sm rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white transition-colors"
            >
              Sign in with Discord
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Create Layout**

```tsx
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="pt-20 pb-12 px-4 max-w-6xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Create ProtectedRoute**

```tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loggedIn, loading } = useAuth();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!loggedIn) return <Navigate to="/" replace />;

  return <>{children}</>;
}
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Layout.tsx web/src/components/Navbar.tsx web/src/components/ProtectedRoute.tsx
git commit -m "feat: add Layout, Navbar, and ProtectedRoute components"
```

---

### Task 18: App router setup

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/main.tsx`

- [ ] **Step 1: Set up App with router**

Replace `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Callback } from './pages/Callback';
import { Daily } from './pages/Daily';
import { PastDaily } from './pages/PastDaily';
import { Archive } from './pages/Archive';
import { Random } from './pages/Random';
import { Custom } from './pages/Custom';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';

export default function App() {
  return (
    <BrowserRouter basename="/Pro2Pro">
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/callback" element={<Callback />} />
            <Route path="/daily" element={<Daily />} />
            <Route path="/daily/:number" element={<ProtectedRoute><PastDaily /></ProtectedRoute>} />
            <Route path="/archive" element={<ProtectedRoute><Archive /></ProtectedRoute>} />
            <Route path="/random" element={<ProtectedRoute><Random /></ProtectedRoute>} />
            <Route path="/custom" element={<ProtectedRoute><Custom /></ProtectedRoute>} />
            <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Update main.tsx**

Replace `web/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 3: Create stub pages (all at once)**

Create each page file in `web/src/pages/` as a minimal stub that exports a named component. Example for each:

`Landing.tsx`, `Callback.tsx`, `Daily.tsx`, `PastDaily.tsx`, `Archive.tsx`, `Random.tsx`, `Custom.tsx`, `Leaderboard.tsx`, `Profile.tsx`

Each follows this pattern (replace name):

```tsx
export function Landing() {
  return <div className="text-center py-20"><h1 className="text-3xl font-bold">Landing Page</h1></div>;
}
```

- [ ] **Step 4: Verify it compiles and runs**

```bash
cd web && npm run build
```
Expected: Build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add web/src/
git commit -m "feat: add router, auth context, stub pages"
```

---

## Chunk 3: Frontend Pages & Components

### Task 19-27: Build each page and component

Each page follows the same pattern: fetch data from the API, render with the futuristic design system. The key complex components are:

- **GameBoard** (used by Daily, PastDaily, Random, Custom) — player search panel, path visualization, guess/giveup buttons
- **PlayerSearch** — debounced input, result cards with flag + team info
- **PathDisplay** — animated chain of player nodes with team connections
- **DifficultyPicker** — three glowing cards for easy/medium/hard
- **Landing** — hero section with animated background, three game mode cards, login CTA
- **Callback** — extracts code from URL, calls api.login, redirects to /daily
- **Archive** — grid of puzzle cards with status badges (available/completed/optimal)
- **Leaderboard** — guild picker dropdown, rankings table with points
- **Profile** — stats cards, streak display, points breakdown

These are implementation-heavy tasks. Each one creates 1-2 files and should be built incrementally, verifying the dev server renders correctly after each.

Due to the size of frontend component code, these tasks should be implemented by the executing agent using the design spec and the patterns established in Tasks 13-18. The agent should:

1. Build `GameBoard` + `PlayerSearch` + `PathDisplay` first (shared by all game modes)
2. Build `Landing` + `Callback` (auth flow)
3. Build `Daily` + `PastDaily` (core game pages)
4. Build `Random` + `DifficultyPicker` + `Custom`
5. Build `Archive` + `PuzzleCard`
6. Build `Leaderboard` + `Profile`

Each group should be committed separately.

---

## Chunk 4: Integration & Polish

### Task 28: GitHub Pages deployment setup

- [ ] **Step 1: Add 404.html for SPA routing on GitHub Pages**

Create `web/public/404.html` that redirects to index.html (standard SPA trick for GitHub Pages).

- [ ] **Step 2: Add .env.example for frontend**

Create `web/.env.example`:

```
VITE_API_URL=http://localhost:3001/api
VITE_DISCORD_CLIENT_ID=1480857828091625534
```

- [ ] **Step 3: Add .env.example for backend**

Update root `.env.example` with new values:

```
API_PORT=3001
JWT_SECRET=change-me-in-production
DISCORD_CLIENT_SECRET=your-discord-client-secret
FRONTEND_URL=https://yourusername.github.io/Pro2Pro
API_BASE_URL=https://your-api-domain.com
```

- [ ] **Step 4: Test full flow**

1. Start bot + API: `node dist/index.js`
2. Start frontend: `cd web && npm run dev`
3. Visit http://localhost:5173/Pro2Pro/
4. Click "Sign in with Discord" → complete OAuth → verify redirect back
5. Play a daily puzzle → verify completion + points
6. Check leaderboard → verify data

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add deployment config and env examples"
```

---

### Task 29: Award points from bot completions

- [ ] **Step 1: Integrate points into existing bot handler**

In `src/bot/interactions/handler.ts`, in the `completeGame` function, after `saveUserAttempt`, call `awardCompletionPoints` the same way the web API does. Import from `../api/points`.

This ensures bot completions also earn points and appear on the unified leaderboard.

- [ ] **Step 2: Commit**

```bash
git add src/bot/interactions/handler.ts
git commit -m "feat: award points from bot game completions"
```
