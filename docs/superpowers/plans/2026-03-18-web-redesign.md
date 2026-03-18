# Pro2Pro Web Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Pro2Pro web frontend with a professional esports aesthetic, unified tab navigation, node-graph game interface with team logos, and gaming-style scoring labels.

**Architecture:** Backend-first changes (scoring labels, team image URLs in API, optional auth for games), then frontend redesign (theme, layout, components). The frontend uses React 19 + Tailwind CSS 4 + Vite 7 + React Router 7. All game logic stays server-side; frontend is purely presentational.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vite 7, Express 5, SQLite

---

## File Structure

### Backend (modify)
- `src/game/scorer.ts` — Replace golf labels with gaming labels
- `src/game/graph.ts` — Add `imageUrl` to teams Map + TeamConnection
- `src/api/games.ts` — Include team image URLs in guess responses, use authOptional
- `src/api/middleware.ts` — Already has `authOptional` (no changes needed)

### Frontend (modify)
- `web/src/index.css` — Theme variables and base styles
- `web/index.html` — Update title
- `web/src/App.tsx` — Route updates
- `web/src/components/Layout.tsx` — Esports theme wrapper
- `web/src/components/Navbar.tsx` — Redesign with optional auth messaging
- `web/src/components/PlayerSearch.tsx` — Restyle for new theme
- `web/src/components/DifficultyPicker.tsx` — Restyle for new theme
- `web/src/pages/Landing.tsx` — Redesigned hero + modes + how-it-works
- `web/src/pages/Daily.tsx` — Integrate new GameBoard + tabs
- `web/src/pages/Random.tsx` — Integrate new GameBoard + tabs
- `web/src/pages/Custom.tsx` — Integrate new GameBoard + tabs
- `web/src/components/GameBoard.tsx` — Complete rewrite: Center Stage layout
- `web/src/components/PathDisplay.tsx` — Delete (replaced by ConnectionGraph)
- `web/src/context/AuthContext.tsx` — Update login messaging

### Frontend (create)
- `web/src/components/GameModeTabs.tsx` — Tab bar for Daily/Random/Custom
- `web/src/components/ConnectionGraph.tsx` — Node graph (desktop) + stacked cards (mobile)
- `web/src/components/CompletionScreen.tsx` — Game-over with gaming labels
- `web/src/components/GiveUpScreen.tsx` — Solutions display
- `web/src/components/PlayerNode.tsx` — Reusable player circle with photo

---

## Task 1: Backend — Replace Golf Scoring with Gaming Labels

**Files:**
- Modify: `src/game/scorer.ts:3-13,21-28,39-75`
- Modify: `src/api/games.ts:271-287`

- [ ] **Step 1: Update ScoreResult interface in scorer.ts**

Replace `golfRating` and `golfEmoji` fields with `rating` label. Remove duplicate `rating` field.

In `src/game/scorer.ts`, replace the `ScoreResult` interface (lines 3-13):
```typescript
export interface ScoreResult {
  pathLength: number;
  optimalLength: number;
  par: number;
  scoreToPar: number;
  rating: string;
  isOptimal: boolean;
  shareText: string;
}
```

- [ ] **Step 2: Replace getGolfRating with getGameRating**

Replace `getGolfRating` function (lines 21-28):
```typescript
/** Get gaming-style rating based on score relative to par */
export function getGameRating(scoreToPar: number): string {
  if (scoreToPar <= -2) return 'Perfect';
  if (scoreToPar === -1) return 'Great';
  if (scoreToPar === 0) return 'Good';
  if (scoreToPar <= 2) return 'Okay';
  if (scoreToPar <= 4) return 'Nice Try';
  return 'Overcooked';
}
```

- [ ] **Step 3: Update scorePath function**

Update `scorePath` (lines 39-75) to use `getGameRating` instead of `getGolfRating`. Remove `golfRating`, `golfEmoji` from return. Update share text to use gaming labels instead of golf terms.

- [ ] **Step 4: Update games.ts completion response**

In `src/api/games.ts`, replace lines 271-287 to use `getGameRating` import and return `rating` instead of `golfRating`/`golfEmoji`:
```typescript
const par = calculatePar(optimalLength);
const scoreToPar = pathLength - par;
const rating = getGameRating(scoreToPar);

res.json({
  valid: true,
  complete: true,
  teams: teamNames,
  path: pathNames,
  pathLength,
  optimalLength,
  par,
  scoreToPar,
  scoreToParStr: formatScoreToPar(scoreToPar),
  rating,
  isOptimal,
  points,
});
```

- [ ] **Step 5: Update imports in games.ts**

Change import from `getGolfRating` to `getGameRating` at line 14.

- [ ] **Step 6: Verify build**

Run: `cd /Users/pattedyr/Documents/GitHub/Pro2Pro && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add src/game/scorer.ts src/api/games.ts
git commit -m "feat: replace golf scoring labels with gaming-style ratings"
```

---

## Task 2: Backend — Add Team Image URLs to Graph and API

**Files:**
- Modify: `src/game/graph.ts:53-57,68,131-137,267-278`
- Modify: `src/api/games.ts:211`

- [ ] **Step 1: Add imageUrl to TeamConnection interface**

In `src/game/graph.ts`, update `TeamConnection` (lines 53-57):
```typescript
export interface TeamConnection {
  teamId: number;
  teamName: string;
  teamAcronym: string | null;
  teamImageUrl: string | null;
}
```

- [ ] **Step 2: Add imageUrl to teams Map type**

Update the `teams` Map at line 68:
```typescript
private teams = new Map<number, { name: string; acronym: string | null; imageUrl: string | null }>();
```

- [ ] **Step 3: Load image_url in build()**

Update the SQL query and map population at lines 131-137:
```typescript
const teamRows = db.prepare('SELECT id, name, acronym, is_notable, image_url FROM teams').all() as any[];
this.teams.clear();
this.notableTeamIds.clear();
for (const row of teamRows) {
  this.teams.set(row.id, { name: row.name, acronym: row.acronym, imageUrl: row.image_url ?? null });
  if (row.is_notable) this.notableTeamIds.add(row.id);
}
```

- [ ] **Step 4: Include imageUrl in getSharedTeams return**

Update `getSharedTeams` (lines 267-278) to include `teamImageUrl`:
```typescript
return uniqueIds.map(id => {
  const team = this.teams.get(id);
  return {
    teamId: id,
    teamName: team?.name ?? 'Unknown',
    teamAcronym: team?.acronym ?? null,
    teamImageUrl: team?.imageUrl ?? null,
  };
});
```

- [ ] **Step 5: Update API guess response to include team images**

In `src/api/games.ts`, update line 211 to return full team connection data:
```typescript
const teamInfo = validation.sharedTeams.map(t => ({
  name: t.teamAcronym ?? t.teamName,
  imageUrl: t.teamImageUrl,
}));
```

Update the non-complete response (around line 298) and complete response (around line 276) to use `teams: teamInfo` instead of `teams: teamNames`.

- [ ] **Step 6: Verify build**

Run: `cd /Users/pattedyr/Documents/GitHub/Pro2Pro && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add src/game/graph.ts src/api/games.ts
git commit -m "feat: include team image URLs in graph and API responses"
```

---

## Task 3: Backend — Make Auth Optional for Game Routes

**Files:**
- Modify: `src/api/games.ts:19,178,306`

- [ ] **Step 1: Import authOptional**

In `src/api/games.ts`, update line 9 import to include `authOptional`:
```typescript
import { authRequired, authOptional } from './middleware';
```

- [ ] **Step 2: Replace authRequired with authOptional on game routes**

Change `authRequired` to `authOptional` on:
- Line 19: `router.post('/start', authOptional, async (req, res) => {`
- Line 178: `router.post('/:sessionId/guess', authOptional, (req, res) => {`
- Line 306: `router.post('/:sessionId/giveup', authOptional, (req, res) => {`

- [ ] **Step 3: Generate stable anonymous session ID on frontend**

In `web/src/api/client.ts`, add an anonymous session ID that persists in localStorage and is sent as `x-session-id` header on all API requests:
```typescript
function getAnonSessionId(): string {
  let id = localStorage.getItem('pro2pro_anon_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('pro2pro_anon_id', id);
  }
  return id;
}
```

In the `apiFetch` function, add the header:
```typescript
headers['x-session-id'] = getAnonSessionId();
```

- [ ] **Step 4: Handle anonymous users on backend**

Update the userId references to fall back to the stable anonymous session ID. Where `req.user!.userId` is used, replace with:
```typescript
const userId = req.user?.userId ?? `anon-${req.headers['x-session-id'] ?? 'unknown'}`;
```

Guard authenticated-only operations with `if (req.user)`:
- Skip `getUserAttempt` duplicate check for daily puzzles (anonymous users can replay)
- Skip `saveUserAttempt` (no attempt tracking for anonymous)
- Skip `awardCompletionPoints` (no points for anonymous)
- Skip `getUserStats` (no streak tracking for anonymous)

Web session creation/retrieval still works — it uses the stable `userId` string (either Discord ID or `anon-xxx`).

- [ ] **Step 5: Verify build**

Run: `cd /Users/pattedyr/Documents/GitHub/Pro2Pro && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/api/games.ts web/src/api/client.ts
git commit -m "feat: make auth optional for game routes (anonymous play)"
```

---

## Task 4: Frontend — Theme, Layout, and Navbar

**Files:**
- Modify: `web/src/index.css`
- Modify: `web/index.html`
- Modify: `web/src/components/Layout.tsx`
- Modify: `web/src/components/Navbar.tsx`
- Modify: `web/src/context/AuthContext.tsx`

- [ ] **Step 1: Update index.html title**

Change `<title>web</title>` to `<title>Pro2Pro — CS2 Connection Game</title>`

- [ ] **Step 2: Add theme CSS to index.css**

Add custom CSS variables and base styles after the Tailwind import:
```css
@import "tailwindcss";

@theme {
  --color-surface: #111118;
  --color-surface-alt: #16161f;
  --color-surface-hover: #1c1c28;
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-accent: rgba(249, 115, 22, 0.3);
  --color-accent: #f97316;
  --color-accent-hover: #fb923c;
  --color-text-primary: #ffffff;
  --color-text-secondary: #9ca3af;
  --color-text-muted: #6b7280;
  --color-start: #4ade80;
  --color-end: #ef4444;
}

body {
  background-color: #0a0a10;
  color: #ffffff;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
```

- [ ] **Step 3: Update Layout.tsx**

```typescript
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function Layout() {
  return (
    <div className="min-h-screen bg-[#0a0a10] text-white">
      <Navbar />
      <main className="pt-20 pb-12 px-4 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Redesign Navbar.tsx**

Redesign with esports styling, optional auth with "Sign in to track stats" messaging:
- Logo with orange underline accent
- Nav links: Daily, Random, Custom, Archive, Leaderboard
- Auth section: if logged in show avatar + points; if logged out show subtle "Sign in with Discord" link with tooltip "Track your stats and compete on the leaderboard"
- Mobile hamburger menu

- [ ] **Step 5: Update AuthContext login messaging**

No code changes needed to AuthContext — the messaging is handled in Navbar.

- [ ] **Step 6: Verify dev server runs**

Run: `cd /Users/pattedyr/Documents/GitHub/Pro2Pro/web && npm run dev` — verify no errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/index.css web/index.html web/src/components/Layout.tsx web/src/components/Navbar.tsx
git commit -m "feat: esports theme, layout, and navbar redesign"
```

---

## Task 5: Frontend — Landing Page Redesign

**Files:**
- Modify: `web/src/pages/Landing.tsx`

- [ ] **Step 1: Redesign Landing.tsx**

Full rewrite with:
- Hero section: large "Pro2Pro" title with orange accent underline, subtitle "Connect CS2 pros through shared teams", CTA button "Play Today's Puzzle"
- Game Mode cards section: three cards (Daily, Random, Custom) with orange accents, clean dark backgrounds, descriptions
- How It Works section: three-step visual guide (Get Two Players → Build the Chain → Complete the Path)
- All styled with the clean dark esports theme (dark surfaces, orange accents, white text)

- [ ] **Step 2: Verify in browser**

Run dev server, navigate to `/`, verify layout looks correct.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Landing.tsx
git commit -m "feat: redesign landing page with esports aesthetic"
```

---

## Task 6: Frontend — GameModeTabs Component

**Files:**
- Create: `web/src/components/GameModeTabs.tsx`

- [ ] **Step 1: Create GameModeTabs component**

```typescript
import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { label: 'Daily', path: '/daily' },
  { label: 'Random', path: '/random' },
  { label: 'Custom', path: '/custom' },
];

export function GameModeTabs() {
  const { pathname } = useLocation();

  return (
    <div className="flex justify-center gap-1 mb-8">
      {tabs.map(tab => {
        const active = pathname.startsWith(tab.path);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              active
                ? 'bg-orange-500/15 border border-orange-500/40 text-orange-400'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/GameModeTabs.tsx
git commit -m "feat: add GameModeTabs navigation component"
```

---

## Task 7: Frontend — PlayerNode Component

**Files:**
- Create: `web/src/components/PlayerNode.tsx`

- [ ] **Step 1: Create reusable PlayerNode component**

Circular player avatar with photo, name, and optional nationality flag. Supports start (green border), end (red border), and intermediate (orange border) variants.

```typescript
interface PlayerNodeProps {
  name: string;
  imageUrl?: string | null;
  nationality?: string | null;
  variant: 'start' | 'end' | 'intermediate' | 'unknown';
  size?: 'sm' | 'md' | 'lg';
}
```

- Uses the player's `imageUrl` from the API as the avatar photo
- Falls back to first 2 letters of name if no image
- Border color based on variant: start=#4ade80, end=#ef4444, intermediate=#f97316, unknown=dashed gray

- [ ] **Step 2: Commit**

```bash
git add web/src/components/PlayerNode.tsx
git commit -m "feat: add PlayerNode reusable component"
```

---

## Task 8: Frontend — ConnectionGraph Component

**Files:**
- Create: `web/src/components/ConnectionGraph.tsx`
- Delete: `web/src/components/PathDisplay.tsx`

- [ ] **Step 1: Create ConnectionGraph component**

Responsive component that renders:
- **Desktop (md+ breakpoint):** Horizontal node graph — PlayerNode circles connected by lines with team logo/badge floating above the connector
- **Mobile (<md):** Stacked link cards — each connection is a row showing [Player] — Team Badge — [Player]

Props:
```typescript
interface ConnectionGraphProps {
  forwardPath: PathPlayer[];
  backwardPath: PathPlayer[];
  teams: TeamLink[];  // teams connecting each adjacent pair
  complete?: boolean;
}

interface PathPlayer {
  id: number;
  name: string;
  nationality?: string;
  imageUrl?: string;
}

interface TeamLink {
  fromId: number;
  toId: number;
  teams: { name: string; imageUrl: string | null }[];
}
```

For team badges between nodes:
- If team has `imageUrl`: show 24x24 rounded image
- If no image: show styled text badge with team acronym on orange-tinted background

- [ ] **Step 2: Commit**

Note: PathDisplay.tsx deletion is deferred to Task 10 when GameBoard is rewritten (it still imports PathDisplay until then).

```bash
git add web/src/components/ConnectionGraph.tsx
git commit -m "feat: add responsive ConnectionGraph component"
```

---

## Task 9: Frontend — CompletionScreen and GiveUpScreen

**Files:**
- Create: `web/src/components/CompletionScreen.tsx`
- Create: `web/src/components/GiveUpScreen.tsx`

- [ ] **Step 1: Create CompletionScreen component**

Game-over screen showing:
- Large rating label ("Perfect", "Great", "Good", etc.) styled prominently
- Stats grid: Steps taken, Optimal, Par, Points earned
- Points breakdown list
- The completed path using ConnectionGraph
- "Play Again" / "Share" buttons
- Orange/amber accent theme consistent with esports aesthetic

- [ ] **Step 2: Create GiveUpScreen component**

Shows:
- "Given Up" header
- Solutions displayed using ConnectionGraph component
- "Play Again" button
- Styled with muted reds for the given-up state

- [ ] **Step 3: Commit**

```bash
git add web/src/components/CompletionScreen.tsx web/src/components/GiveUpScreen.tsx
git commit -m "feat: add CompletionScreen and GiveUpScreen components"
```

---

## Task 10: Frontend — GameBoard Rewrite (Center Stage)

**Files:**
- Modify: `web/src/components/GameBoard.tsx`
- Modify: `web/src/hooks/useGame.ts`

- [ ] **Step 1: Update useGame hook to track team connections**

Add `teamLinks` to `GameSession` interface to track which teams connect each pair of players. Update the `guess` callback to accumulate team connection data from API responses.

```typescript
interface TeamLink {
  fromId: number;
  toId: number;
  teams: { name: string; imageUrl: string | null }[];
}

interface GameSession {
  sessionId: string;
  forwardPath: Player[];
  backwardPath: Player[];
  teamLinks: TeamLink[];
  complete: boolean;
  givenUp: boolean;
  result: any | null;
  solutions: any[] | null;
  error: string | null;
}
```

- [ ] **Step 2: Rewrite GameBoard.tsx — Center Stage layout**

Complete rewrite with:
- **Top:** Start and end player "goalposts" using PlayerNode (large size), anchored side by side with dots between
- **Middle:** ConnectionGraph showing the chain built so far
- **Direction toggle:** Forward/backward buttons styled with orange theme
- **Search:** PlayerSearch component centered below
- **Stats bar:** Par, Steps, Optimal — orange accents
- **Give Up:** Subtle button at bottom
- Delegates to CompletionScreen when complete, GiveUpScreen when given up

- [ ] **Step 3: Delete PathDisplay.tsx**

Remove `web/src/components/PathDisplay.tsx` — fully replaced by ConnectionGraph. Safe now that GameBoard no longer imports it.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/GameBoard.tsx web/src/hooks/useGame.ts
git rm web/src/components/PathDisplay.tsx
git commit -m "feat: rewrite GameBoard with Center Stage layout"
```

---

## Task 11: Frontend — Restyle PlayerSearch and DifficultyPicker

**Files:**
- Modify: `web/src/components/PlayerSearch.tsx`
- Modify: `web/src/components/DifficultyPicker.tsx`

- [ ] **Step 1: Restyle PlayerSearch**

Update classes to use new theme:
- Input: dark surface background, orange accent border on focus, gray-500 placeholder
- Dropdown: dark surface with orange hover highlights
- Player items: show avatar, name, teams, nationality with esports styling
- Spinner: orange instead of cyan

- [ ] **Step 2: Restyle DifficultyPicker**

Update the three difficulty cards:
- Easy: green accent (keep)
- Medium: orange/amber accent (was yellow)
- Hard: red accent (keep)
- Card backgrounds: dark surface with subtle borders
- Remove emojis, use clean text labels

- [ ] **Step 3: Commit**

```bash
git add web/src/components/PlayerSearch.tsx web/src/components/DifficultyPicker.tsx
git commit -m "feat: restyle PlayerSearch and DifficultyPicker for esports theme"
```

---

## Task 12: Frontend — Integrate Game Pages with Tabs and New Components

**Files:**
- Modify: `web/src/pages/Daily.tsx`
- Modify: `web/src/pages/Random.tsx`
- Modify: `web/src/pages/Custom.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Update Daily.tsx**

- Add GameModeTabs at top
- Use redesigned GameBoard
- Update pre-game info screen with PlayerNode goalposts
- Update "already completed" view with gaming labels
- Restyle with esports theme colors

- [ ] **Step 2: Update Random.tsx**

- Add GameModeTabs at top
- Use DifficultyPicker (restyled) for difficulty selection
- Use redesigned GameBoard
- Restyle with esports theme

- [ ] **Step 3: Update Custom.tsx**

- Add GameModeTabs at top
- Use PlayerSearch for start/end player selection
- Use redesigned GameBoard
- Restyle with esports theme

- [ ] **Step 4: Verify App.tsx routes**

Ensure routes are correct. Remove ProtectedRoute wrapper if game pages were protected — they should be accessible without auth now.

- [ ] **Step 5: Full visual test**

Run dev server, test all three game modes end to end. Verify:
- Tab navigation works
- Theme is consistent
- Desktop: node graph displays
- Mobile (resize browser): stacked cards display
- Completion screen shows gaming labels
- Give up screen shows solutions

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/Daily.tsx web/src/pages/Random.tsx web/src/pages/Custom.tsx web/src/App.tsx
git commit -m "feat: integrate game pages with tabs and new components"
```

---

## Task 13: Build Verification and Cleanup

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/pattedyr/Documents/GitHub/Pro2Pro && npx tsc --noEmit
cd /Users/pattedyr/Documents/GitHub/Pro2Pro/web && npx tsc --noEmit
```

- [ ] **Step 2: Run frontend build**

```bash
cd /Users/pattedyr/Documents/GitHub/Pro2Pro/web && npm run build
```

- [ ] **Step 3: Fix any build errors**

- [ ] **Step 4: Remove unused imports/files**

Check for any orphaned imports of PathDisplay, golfRating, golfEmoji, etc.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: build verification and cleanup"
```
