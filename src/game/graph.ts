import { getDb } from '../data/db';

/** Convert ISO 2-letter country code to flag emoji (e.g. "NO" -> "🇳🇴") */
function countryToFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    ...Array.from(upper).map(c => 0x1F1E6 + c.charCodeAt(0) - 65)
  );
}

/** Levenshtein edit distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Normalize leetspeak characters to their letter equivalents */
function normalizeLeet(str: string): string {
  return str
    .replace(/1/g, 'i')
    .replace(/0/g, 'o')
    .replace(/3/g, 'e')
    .replace(/7/g, 't')
    .replace(/5/g, 's')
    .replace(/4/g, 'a')
    .replace(/8/g, 'b')
    .replace(/@/g, 'a')
    .replace(/!/g, 'i')
    .toLowerCase();
}

export interface PlayerNode {
  id: number;
  name: string;
  nationality: string | null;
  imageUrl: string | null;
}

export interface TeamConnection {
  teamId: number;
  teamName: string;
  teamAcronym: string | null;
}

/**
 * In-memory player graph built from roster data.
 * Two players are connected if they shared a team roster in the same tournament.
 * Edges store which team(s) they shared.
 */
export class PlayerGraph {
  // adjacency list: playerId -> Map<playerId, teamIds[]>
  private adjacency = new Map<number, Map<number, number[]>>();
  private players = new Map<number, PlayerNode>();
  private teams = new Map<number, { name: string; acronym: string | null }>();
  private playerNameIndex = new Map<string, number[]>(); // lowercase name -> ids (multiple for dupes)
  private playerNormalizedIndex = new Map<string, number[]>(); // normalized name -> ids
  private playerNormalizedName = new Map<number, string>(); // playerId -> normalized name (for sort perf)
  private playerTeamNames = new Map<number, string[]>(); // playerId -> team acronyms for display
  private playerTeamIdList = new Map<number, number[]>(); // playerId -> unique team IDs (ordered by first appearance)
  private playerTeamRosterCounts = new Map<number, Map<number, number>>(); // playerId -> teamId -> roster entry count
  private teamTotalRosterCount = new Map<number, number>(); // teamId -> total roster entries (proxy for notability)
  private playerCurrentTeam = new Map<number, string>(); // playerId -> current/active team acronym
  private notableTeamIds = new Set<number>(); // teams from major tournaments
  private notablePlayerIds = new Set<number>(); // players on notable teams
  private playerNotableTeamCount = new Map<number, number>(); // playerId -> count of notable teams
  private playerAPlusCount = new Map<number, number>(); // playerId -> A+ tier tournament count
  private playerBPlusCount = new Map<number, number>(); // playerId -> B+ tier tournament count
  private playerCctCount = new Map<number, number>(); // playerId -> CCT tournament count

  get nodeCount(): number {
    return this.players.size;
  }

  get edgeCount(): number {
    let count = 0;
    for (const neighbors of this.adjacency.values()) {
      count += neighbors.size;
    }
    return count / 2; // undirected
  }

  build(): void {
    const db = getDb();

    // Load players
    const playerRows = db.prepare('SELECT id, name, nationality, image_url FROM players').all() as any[];
    this.players.clear();
    this.playerNameIndex.clear();
    for (const row of playerRows) {
      this.players.set(row.id, {
        id: row.id,
        name: row.name,
        nationality: row.nationality ?? null,
        imageUrl: row.image_url,
      });
      const key = row.name.toLowerCase();
      if (!this.playerNameIndex.has(key)) {
        this.playerNameIndex.set(key, []);
      }
      this.playerNameIndex.get(key)!.push(row.id);
    }

    // Build normalized name index (leetspeak-aware)
    this.playerNormalizedIndex.clear();
    this.playerNormalizedName.clear();
    for (const [id, player] of this.players) {
      const normalized = normalizeLeet(player.name);
      this.playerNormalizedName.set(id, normalized);
      if (!this.playerNormalizedIndex.has(normalized)) {
        this.playerNormalizedIndex.set(normalized, []);
      }
      this.playerNormalizedIndex.get(normalized)!.push(id);
    }

    // Load teams
    const teamRows = db.prepare('SELECT id, name, acronym, is_notable FROM teams').all() as any[];
    this.teams.clear();
    this.notableTeamIds.clear();
    for (const row of teamRows) {
      this.teams.set(row.id, { name: row.name, acronym: row.acronym });
      if (row.is_notable) this.notableTeamIds.add(row.id);
    }

    // Build adjacency from rosters — group by (team_id, tournament_id)
    // Players only connect if they shared the same team in the same tournament.
    // Current active rosters (tournament_id = NULL) are grouped together per team.
    this.adjacency.clear();

    const rosterRows = db.prepare(
      'SELECT player_id, team_id, tournament_id FROM rosters ORDER BY team_id, tournament_id'
    ).all() as any[];

    const groupPlayers = new Map<string, number[]>();
    for (const row of rosterRows) {
      const key = `${row.team_id}:${row.tournament_id ?? 'null'}`;
      if (!groupPlayers.has(key)) {
        groupPlayers.set(key, []);
      }
      groupPlayers.get(key)!.push(row.player_id);
    }

    // Build playerTeamNames for display disambiguation + track notable players + current team
    this.playerTeamNames.clear();
    this.playerTeamIdList.clear();
    this.playerTeamRosterCounts.clear();
    this.playerCurrentTeam.clear();
    this.notablePlayerIds.clear();
    this.playerNotableTeamCount.clear();
    const playerNotableSet = new Map<number, Set<number>>(); // playerId -> set of notable teamIds
    for (const row of rosterRows) {
      if (!this.playerTeamNames.has(row.player_id)) {
        this.playerTeamNames.set(row.player_id, []);
      }
      if (!this.playerTeamIdList.has(row.player_id)) {
        this.playerTeamIdList.set(row.player_id, []);
      }
      const team = this.teams.get(row.team_id);
      const label = team?.acronym ?? team?.name ?? '';
      if (label && !this.playerTeamNames.get(row.player_id)!.includes(label)) {
        this.playerTeamNames.get(row.player_id)!.push(label);
      }
      const teamIds = this.playerTeamIdList.get(row.player_id)!;
      if (!teamIds.includes(row.team_id)) {
        teamIds.push(row.team_id);
      }
      if (!this.playerTeamRosterCounts.has(row.player_id)) {
        this.playerTeamRosterCounts.set(row.player_id, new Map());
      }
      const rosterCounts = this.playerTeamRosterCounts.get(row.player_id)!;
      rosterCounts.set(row.team_id, (rosterCounts.get(row.team_id) ?? 0) + 1);
      // Track current team from active roster entries (tournament_id = NULL)
      if (row.tournament_id === null && label && !this.playerCurrentTeam.has(row.player_id)) {
        this.playerCurrentTeam.set(row.player_id, label);
      }
      if (this.notableTeamIds.has(row.team_id)) {
        this.notablePlayerIds.add(row.player_id);
        if (!playerNotableSet.has(row.player_id)) {
          playerNotableSet.set(row.player_id, new Set());
        }
        playerNotableSet.get(row.player_id)!.add(row.team_id);
      }
    }
    // Build team total roster counts (proxy for team notability)
    this.teamTotalRosterCount.clear();
    for (const row of rosterRows) {
      this.teamTotalRosterCount.set(row.team_id, (this.teamTotalRosterCount.get(row.team_id) ?? 0) + 1);
    }

    for (const [id, teams] of playerNotableSet) {
      this.playerNotableTeamCount.set(id, teams.size);
    }

    // Load player tournament tier counts
    this.playerAPlusCount.clear();
    this.playerBPlusCount.clear();
    this.playerCctCount.clear();
    try {
      const tierRows = db.prepare(
        'SELECT player_id, a_plus_count, b_plus_count, cct_count FROM player_tournament_counts'
      ).all() as any[];
      for (const row of tierRows) {
        this.playerAPlusCount.set(row.player_id, row.a_plus_count ?? 0);
        this.playerBPlusCount.set(row.player_id, row.b_plus_count ?? 0);
        this.playerCctCount.set(row.player_id, row.cct_count ?? 0);
      }
    } catch (_) {
      // Table may not exist yet — tier data will be empty, fallback logic handles it
    }

    // For each (team, tournament) group, connect all players who were on that roster
    for (const [groupKey, players] of groupPlayers) {
      const teamId = parseInt(groupKey.split(':')[0], 10);
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          this.addEdge(players[i], players[j], teamId);
        }
      }
    }

    console.log(`[Graph] Built graph: ${this.nodeCount} players, ${this.edgeCount} edges, ${this.notablePlayerIds.size} notable players (${this.notableTeamIds.size} notable teams)`);
  }

  private addEdge(a: number, b: number, teamId: number): void {
    if (!this.adjacency.has(a)) this.adjacency.set(a, new Map());
    if (!this.adjacency.has(b)) this.adjacency.set(b, new Map());

    const aNeighbors = this.adjacency.get(a)!;
    const bNeighbors = this.adjacency.get(b)!;

    if (!aNeighbors.has(b)) aNeighbors.set(b, []);
    if (!bNeighbors.has(a)) bNeighbors.set(a, []);

    aNeighbors.get(b)!.push(teamId);
    bNeighbors.get(a)!.push(teamId);
  }

  getNeighbors(playerId: number): number[] {
    return Array.from(this.adjacency.get(playerId)?.keys() ?? []);
  }

  getSharedTeams(playerA: number, playerB: number): TeamConnection[] {
    const teamIds = this.adjacency.get(playerA)?.get(playerB) ?? [];
    const uniqueIds = [...new Set(teamIds)];
    return uniqueIds.map(id => {
      const team = this.teams.get(id);
      return {
        teamId: id,
        teamName: team?.name ?? 'Unknown',
        teamAcronym: team?.acronym ?? null,
      };
    });
  }

  /**
   * Get the number of shared teams between two connected players.
   * Returns 0 if they are not connected.
   */
  getSharedTeamCount(playerA: number, playerB: number): number {
    const teamIds = this.adjacency.get(playerA)?.get(playerB) ?? [];
    return new Set(teamIds).size;
  }

  /**
   * Score how "obscure" a path is. Higher = more obscure.
   * Considers: weak links (few shared teams) and non-famous intermediate players.
   * Returns a score from 0 (well-known links) to 1 (very obscure).
   */
  getPathObscurityScore(path: number[]): number {
    if (path.length < 3) return 0;

    let weakLinkScore = 0;
    let obscurePlayerScore = 0;
    const linkCount = path.length - 1;
    const intermediateCount = path.length - 2;

    // Score links: fewer shared teams = more obscure
    for (let i = 0; i < linkCount; i++) {
      const shared = this.getSharedTeamCount(path[i], path[i + 1]);
      if (shared <= 1) weakLinkScore += 1.0;
      else if (shared <= 2) weakLinkScore += 0.5;
    }

    // Score intermediate players: lower tier = more obscure
    for (let i = 1; i < path.length - 1; i++) {
      const tier = this.getPlayerTierScore(path[i]);
      if (tier === 0) obscurePlayerScore += 1.0;
      else if (tier <= 1) obscurePlayerScore += 0.7;
      else if (tier <= 2) obscurePlayerScore += 0.3;
    }

    const linkRatio = linkCount > 0 ? weakLinkScore / linkCount : 0;
    const playerRatio = intermediateCount > 0 ? obscurePlayerScore / intermediateCount : 0;
    return (linkRatio + playerRatio) / 2;
  }

  /**
   * Get player name with country flag emoji, e.g. "🇳🇴 rain"
   */
  getPlayerNameWithFlag(id: number): string {
    const player = this.players.get(id);
    if (!player) return '???';
    const flag = countryToFlag(player.nationality);
    return flag ? `${flag} ${player.name}` : player.name;
  }

  getPlayer(id: number): PlayerNode | undefined {
    return this.players.get(id);
  }

  /**
   * Search for players by name.
   *
   * Three-phase matching:
   * 1. Exact match on original name (case-insensitive)
   * 2. Exact match on normalized name (leetspeak-aware)
   * 3. Substring match on both original and normalized names
   *
   * If filterNotable is true, only notable players are returned — except for
   * exact name matches which are always included.
   */
  searchPlayers(query: string, limit = 10, filterNotable = true): PlayerNode[] {
    const q = query.toLowerCase();
    const qNorm = normalizeLeet(query);
    const seen = new Set<number>();
    const results: PlayerNode[] = [];

    const addPlayer = (id: number) => {
      if (seen.has(id)) return;
      seen.add(id);
      const player = this.players.get(id);
      if (player) results.push(player);
    };

    // Check if a player name is an exact case-insensitive match
    const isExactMatch = (id: number): boolean => {
      const player = this.players.get(id);
      return player ? player.name.toLowerCase() === q : false;
    };

    // Phase 1: Exact match on original name
    const exactIds = this.playerNameIndex.get(q);
    if (exactIds) {
      for (const id of exactIds) addPlayer(id);
    }

    // Phase 2: Exact match on normalized name
    const normExactIds = this.playerNormalizedIndex.get(qNorm);
    if (normExactIds) {
      for (const id of normExactIds) addPlayer(id);
    }

    // Phase 3: Substring match on original and normalized names
    for (const [name, ids] of this.playerNameIndex) {
      if (name.includes(q)) {
        for (const id of ids) addPlayer(id);
      }
    }
    for (const [normName, ids] of this.playerNormalizedIndex) {
      if (normName.includes(qNorm)) {
        for (const id of ids) addPlayer(id);
      }
    }

    // Apply notable filter if requested
    let filtered = results;
    if (filterNotable) {
      filtered = results.filter(p => isExactMatch(p.id) || this.isNotablePlayer(p.id));
    }

    // Sort: exact > starts-with > notable tier score > team count > alphabetical
    filtered.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aNorm = this.playerNormalizedName.get(a.id) ?? '';
      const bNorm = this.playerNormalizedName.get(b.id) ?? '';

      // Exact match on original name first
      const aExact = aName === q ? 1 : 0;
      const bExact = bName === q ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      // Exact match on normalized name
      const aNormExact = aNorm === qNorm ? 1 : 0;
      const bNormExact = bNorm === qNorm ? 1 : 0;
      if (aNormExact !== bNormExact) return bNormExact - aNormExact;

      // Starts-with on original or normalized
      const aStarts = aName.startsWith(q) || aNorm.startsWith(qNorm) ? 1 : 0;
      const bStarts = bName.startsWith(q) || bNorm.startsWith(qNorm) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;

      // Notable tier score
      const aTier = this.getPlayerTierScore(a.id);
      const bTier = this.getPlayerTierScore(b.id);
      if (aTier !== bTier) return bTier - aTier;

      // Team count
      const aTeams = this.playerTeamNames.get(a.id)?.length ?? 0;
      const bTeams = this.playerTeamNames.get(b.id)?.length ?? 0;
      if (aTeams !== bTeams) return bTeams - aTeams;

      return aName.localeCompare(bName);
    });

    return filtered.slice(0, limit);
  }

  /**
   * Fuzzy search: find closest player names by edit distance when exact/substring search fails.
   * Returns up to `limit` players sorted by distance, filtered to max distance 3.
   */
  fuzzySearchPlayers(query: string, limit = 5): PlayerNode[] {
    const q = query.toLowerCase();
    const qNorm = normalizeLeet(query);
    const candidates: { id: number; dist: number }[] = [];

    // Score each unique player name
    const seen = new Set<number>();
    for (const [name, ids] of this.playerNameIndex) {
      const dist = Math.min(levenshtein(q, name), levenshtein(qNorm, normalizeLeet(name)));
      // Allow distance proportional to query length, max 3
      const maxDist = Math.min(3, Math.max(1, Math.floor(q.length / 2)));
      if (dist <= maxDist) {
        for (const id of ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          candidates.push({ id, dist });
        }
      }
    }

    candidates.sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return this.getPlayerTierScore(b.id) - this.getPlayerTierScore(a.id);
    });

    return candidates
      .slice(0, limit)
      .map(c => this.players.get(c.id)!)
      .filter(Boolean);
  }

  /**
   * Get display label for a player, including disambiguation info.
   * Always shows flag + team info for better UX.
   * e.g. "rain (🇳🇴 — FaZe, G2, 100T)"
   */
  getPlayerDisplayName(id: number): string {
    const player = this.players.get(id);
    if (!player) return `Unknown (${id})`;

    const teams = this.playerTeamNames.get(id) ?? [];
    const topTeams = teams.slice(0, 3).join(', ');
    const flag = countryToFlag(player.nationality) || '??';

    // Check if this name is shared by multiple players
    const ids = this.playerNameIndex.get(player.name.toLowerCase()) ?? [];
    if (ids.length > 1 || teams.length > 0) {
      return `${player.name} (${flag} — ${topTeams || 'no teams'})`;
    }
    return player.name;
  }

  /**
   * Get full team names for a player (up to `count`), sorted by roster count (most played first).
   * Returns names like "Natus Vincere" instead of "NAVI".
   */
  getPlayerFullTeamNames(id: number, count = 2): string[] {
    const teamIds = this.playerTeamIdList.get(id) ?? [];
    if (teamIds.length === 0) return [];

    const teamCounts = this.playerTeamRosterCounts.get(id);

    // Sort by combined score: player's time on team * team's overall size
    // This surfaces well-known orgs where the player spent significant time
    const sorted = [...teamIds].sort((a, b) => {
      const aPlayer = teamCounts?.get(a) ?? 0;
      const bPlayer = teamCounts?.get(b) ?? 0;
      const aTeam = this.teamTotalRosterCount.get(a) ?? 0;
      const bTeam = this.teamTotalRosterCount.get(b) ?? 0;
      return (bPlayer * bTeam) - (aPlayer * aTeam);
    });

    const names: string[] = [];
    for (const tid of sorted) {
      if (names.length >= count) break;
      const team = this.teams.get(tid);
      if (!team) continue;
      const name = team.name;
      if (name && name !== '?' && !names.includes(name)) {
        names.push(name);
      }
    }
    return names;
  }

  /**
   * Get button label for player search results.
   * Shows flag, name, and top team acronym for disambiguation.
   * e.g. "🇺🇦 s1mple — NAVI"
   */
  getPlayerButtonLabel(id: number): string {
    const player = this.players.get(id);
    if (!player) return `Unknown`;

    const teams = this.playerTeamNames.get(id) ?? [];
    const ids = this.playerNameIndex.get(player.name.toLowerCase()) ?? [];
    const female = this.isFemalePlayer(id) ? ' (F)' : '';
    const flag = countryToFlag(player.nationality);

    if (ids.length > 1) {
      // Duplicate name — must disambiguate
      const topTeam = teams[0] ?? '?';
      return `${flag} ${player.name} — ${topTeam}${female}`.slice(0, 80);
    }
    return `${flag} ${player.name}${female}`.slice(0, 80);
  }

  findPlayerByName(name: string): PlayerNode | undefined {
    const ids = this.playerNameIndex.get(name.toLowerCase());
    if (!ids || ids.length === 0) return undefined;
    // If multiple, return the one with the most team connections
    if (ids.length === 1) return this.players.get(ids[0]);
    let bestId = ids[0];
    let bestTeams = 0;
    for (const id of ids) {
      const count = this.playerTeamNames.get(id)?.length ?? 0;
      if (count > bestTeams) {
        bestTeams = count;
        bestId = id;
      }
    }
    return this.players.get(bestId);
  }

  getPlayerTeams(id: number): string[] {
    return this.playerTeamNames.get(id) ?? [];
  }

  /** Get the player's current/last known team acronym (from active roster, or first known team). */
  getPlayerCurrentTeam(id: number): string | null {
    return this.playerCurrentTeam.get(id) ?? this.playerTeamNames.get(id)?.[0] ?? null;
  }

  /**
   * Check if a player is on a female team (team name/acronym contains .F, fe, Female).
   */
  isFemalePlayer(id: number): boolean {
    const teams = this.playerTeamNames.get(id) ?? [];
    return teams.some(t =>
      /\.F$|\.Fe$| fe$|^.*Female.*$| fe /i.test(t)
    );
  }

  /**
   * Get autocomplete label: always shows "name (flag — TopTeam)" format.
   * Max ~100 chars for Discord autocomplete.
   */
  getAutocompleteName(id: number): string {
    const player = this.players.get(id);
    if (!player) return `Unknown`;

    const flag = countryToFlag(player.nationality) || '??';
    const teams = this.playerTeamNames.get(id) ?? [];
    const topTeam = teams[0] ?? '?';
    const female = this.isFemalePlayer(id) ? ' (F)' : '';

    return `${player.name} (${flag} — ${topTeam})${female}`.slice(0, 100);
  }

  /** Get all player IDs that have at least one connection */
  getConnectedPlayerIds(): number[] {
    return Array.from(this.adjacency.keys()).filter(
      id => (this.adjacency.get(id)?.size ?? 0) > 0
    );
  }

  /**
   * Check if a player is notable based on tournament tier data.
   * A player is notable if they have >= 1 B+ tier tournament or >= 5 CCT tournaments.
   */
  isNotablePlayer(id: number): boolean {
    // If tier data is loaded, use it
    if (this.playerBPlusCount.size > 0 || this.playerCctCount.size > 0) {
      const bPlus = this.playerBPlusCount.get(id) ?? 0;
      const cct = this.playerCctCount.get(id) ?? 0;
      return bPlus >= 1 || cct >= 5;
    }
    // Fallback to old notable team logic
    return this.notablePlayerIds.has(id) && (this.playerNotableTeamCount.get(id) ?? 0) >= 2;
  }

  /**
   * Get a tier score for a player based on tournament participation.
   * 4 = A+ (3+ premier), 3 = B+ (1+ broad), 2 = CCT regular (5+), 1 = any CCT, 0 = none
   */
  getPlayerTierScore(id: number): number {
    const aPlus = this.playerAPlusCount.get(id) ?? 0;
    const bPlus = this.playerBPlusCount.get(id) ?? 0;
    const cct = this.playerCctCount.get(id) ?? 0;
    if (aPlus >= 3) return 4;
    if (bPlus >= 1) return 3;
    if (cct >= 5) return 2;
    if (cct >= 1) return 1;
    return 0;
  }

  /**
   * Get "notable" player IDs — players who meet the isNotablePlayer() criteria.
   * Falls back to players with multiple notable teams or 3+ teams if no tier data.
   */
  getNotablePlayerIds(): number[] {
    // If tier data is available, use isNotablePlayer()
    if (this.playerBPlusCount.size > 0 || this.playerCctCount.size > 0) {
      return Array.from(this.players.keys()).filter(
        id => this.isNotablePlayer(id) && (this.adjacency.get(id)?.size ?? 0) > 0
      );
    }
    // Fallback: old notable team logic
    if (this.notablePlayerIds.size > 0) {
      return Array.from(this.playerNotableTeamCount.entries())
        .filter(([id, count]) => count >= 2 && (this.adjacency.get(id)?.size ?? 0) > 0)
        .map(([id]) => id);
    }
    // Final fallback: players with multiple teams
    return Array.from(this.adjacency.keys()).filter(id => {
      const teamCount = this.playerTeamNames.get(id)?.length ?? 0;
      return teamCount >= 3 && (this.adjacency.get(id)?.size ?? 0) > 0;
    });
  }

  /** Get A+ tier player IDs — players with 5+ premier tournaments (BLAST/PGL/IEM/ESL) */
  getFamousPlayerIds(): number[] {
    return Array.from(this.players.keys()).filter(id => {
      if ((this.adjacency.get(id)?.size ?? 0) === 0) return false;
      return (this.playerAPlusCount.get(id) ?? 0) >= 5;
    });
  }

  areConnected(playerA: number, playerB: number): boolean {
    return this.adjacency.get(playerA)?.has(playerB) ?? false;
  }
}

// Singleton
export const playerGraph = new PlayerGraph();
