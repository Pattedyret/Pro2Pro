# Liquipedia Historical Roster Backfill

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan.

**Goal:** Backfill 2012-2016 CS:GO roster data from Liquipedia to fill the gap in PandaScore data.

**Architecture:** One-time sync script that discovers all CS:GO teams via Liquipedia's category API, fetches each team's roster timeline from wikitext, parses join/leave events, builds yearly roster snapshots, maps players to existing PandaScore IDs, and inserts missing connections into the database with synthetic tournament IDs.

**Tech Stack:** TypeScript, axios, SQLite (better-sqlite3), Liquipedia MediaWiki API

---

### Task 1: Liquipedia API Client with Rate Limiting & Caching

**Files:**
- Create: `src/data/sync/liquipedia.ts`

- [ ] **Step 1:** Create the Liquipedia API client class with:
  - axios instance for `liquipedia.net/counterstrike/api.php`
  - 5-second delay between requests
  - Local file cache (`data/liquipedia-cache/`) to avoid re-fetching pages
  - `fetchTeamPage(title)` — returns wikitext via `action=parse`
  - `discoverTeams()` — paginates `action=query&list=categorymembers&cmtitle=Category:Teams`

### Task 2: Wikitext Roster Parser

**Files:**
- Create: `src/data/sync/liquipediaParser.ts`

- [ ] **Step 1:** Build parser that extracts roster changes from team page wikitext:
  - Extract Timeline section (between `===Timeline===` or year tabs)
  - Parse year context from tab headers
  - For each bullet point, extract: date, player names from `[[...]]`, action (join/leave)
  - Handle common patterns: "joins", "leaves", "signs", "acquires", "releases", "departs", "parts ways", "benches", "formed with", "roster acquired"
  - Handle `[[Name|Display]]` wiki links
  - Return structured `RosterChange[]` array

- [ ] **Step 2:** Build yearly roster builder:
  - Process roster changes chronologically
  - Track who is on the team at each point
  - Output `Map<year, playerNames[]>` — who was on the team during each year

### Task 3: Player & Team ID Mapping

**Files:**
- Modify: `src/data/sync/liquipedia.ts`

- [ ] **Step 1:** Player name matching:
  - Case-insensitive lookup in existing `players` table
  - Handle common variations (spaces, hyphens, dots)
  - Create new player entries (with negative IDs starting at -100000) for unknown players
  - Log all created players for manual review

- [ ] **Step 2:** Team name matching:
  - Match Liquipedia page title to existing teams by acronym or name
  - Create new team entries (with negative IDs) for unknown teams
  - Manual mapping table for known mismatches (e.g., "Natus_Vincere" -> "NAVI")

### Task 4: Database Insertion

**Files:**
- Modify: `src/data/sync/liquipedia.ts`

- [ ] **Step 1:** Insert historical rosters:
  - For each team+year combination, use synthetic tournament IDs (negative, starting at -1)
  - Each team+year gets a unique synthetic tournament ID
  - Insert roster entries for all players on that team during that year
  - Use INSERT OR IGNORE to avoid duplicates
  - After insertion, rebuild the player graph

### Task 5: Backfill Script

**Files:**
- Create: `scripts/backfill-liquipedia.ts`

- [ ] **Step 1:** Create runnable script:
  - Discover all teams from Liquipedia
  - Filter to CS:GO era teams (skip CS 1.6 only teams if possible)
  - Process each team: fetch page, parse timeline, build yearly rosters, map IDs, insert
  - Progress logging with counts
  - Error handling: log failures, continue processing
  - Summary at end: teams processed, players mapped/created, rosters inserted
