# Pro2Pro Web Redesign — Design Spec

## Overview

Redesign the Pro2Pro web frontend with a professional esports aesthetic, unified tab-based game mode navigation, a visual node-graph game interface showing team logos on connections, and gaming-style scoring labels replacing golf terminology.

## Design Decisions

### Visual Direction: Clean Dark Esports
- Dark backgrounds (#111118 base)
- Warm orange/amber (#f97316) primary accent
- White text, gray-400 secondary text
- HLTV/BLAST-inspired professional aesthetic
- Subtle borders, minimal backgrounds (rgba white 3-6%)
- No neon, no glassmorphism — clean and readable

### Layout: Center Stage Game Board
- Start & end players anchored at top as fixed "goalposts" with player photos
- Chain builds in the middle area as a flowing visualization
- Search bar centered below the chain
- Stats (par, steps, optimal) below search

### Game Mode Navigation: Tab Bar with Separate Routes
- Prominent tab bar at top of game area: Daily | Random | Custom
- Each mode has its own URL (/daily, /random, /custom)
- Active tab styled with orange accent
- Tabs visible during gameplay for easy mode switching

### Team Connection Display: Responsive
- **Desktop (≥768px):** Node Graph — players as circular nodes connected by lines, team logos/badges float above the connecting line between players
- **Mobile (<768px):** Stacked Link Cards — each connection is its own row: [Player A] — Team Badge — [Player B]
- Team logos from `teams.image_url` (PandaScore). Fallback: styled text badge with team acronym

### Scoring: Gaming Labels (No Golf)
- Remove all golf terminology (Eagle, Birdie, Par, Bogey)
- Keep the par system (par = optimal + 2)
- New labels based on score-to-par:
  - ≤ -2: "Perfect"
  - -1: "Great"
  - 0: "Good"
  - +1, +2: "Okay"
  - +3, +4: "Nice Try"
  - +5 or worse: "Overcooked"

### Landing Page
- Keep separate landing page at /
- Hero section with Pro2Pro branding
- Three game mode cards linking to /daily, /random, /custom
- "How it works" section

### Authentication
- Keep Discord OAuth but make it optional
- Anyone can play without signing in
- Login presented as "Sign in with Discord to track your stats"
- Disclaimer that auth is only for leaderboard/points/streaks

## Backend Changes Required

1. **Team image URLs in graph:** Load `image_url` from teams table into the in-memory PlayerGraph
2. **Team images in API responses:** Include `teamImageUrl` in guess responses alongside team names
3. **Scoring labels:** Replace golf rating functions with gaming labels in scorer.ts
4. **Auth optional for games:** Allow game start/guess/giveup without auth token (anonymous sessions)

## Frontend Changes Required

1. **index.css:** Custom CSS variables and base styles for the esports theme
2. **Layout.tsx:** Updated dark esports styling
3. **Navbar.tsx:** Redesigned with optional auth, "sign in for stats" messaging
4. **Landing.tsx:** Redesigned hero + game mode cards + how-it-works
5. **GameModeTabs.tsx (new):** Shared tab bar component for Daily/Random/Custom
6. **GameBoard.tsx:** Complete redesign — Center Stage layout with goalposts
7. **PathDisplay.tsx → ConnectionGraph.tsx:** Node graph (desktop) / stacked cards (mobile)
8. **PlayerSearch.tsx:** Restyled for the new theme
9. **DifficultyPicker.tsx:** Restyled
10. **Daily.tsx:** Integrated with new GameBoard + tabs
11. **Random.tsx:** Integrated with new GameBoard + tabs
12. **Custom.tsx:** Integrated with new GameBoard + tabs
13. **CompletionScreen.tsx (new):** Game-over screen with gaming labels, stats, share
14. **GiveUpScreen.tsx (new):** Shows solutions with the new styling

## Out of Scope
- Leaderboard/Profile/Archive page redesigns (keep as-is for now)
- Discord bot changes
- New game mechanics or features
