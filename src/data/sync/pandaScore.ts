import axios, { AxiosInstance } from 'axios';
import { getDb } from '../db';
import { config } from '../../config';
import { playerGraph } from '../../game/graph';

/** Check if a team name/acronym indicates a female team */
function isFemaleTeam(team: { name?: string; acronym?: string }): boolean {
  const name = team.name ?? '';
  const acronym = team.acronym ?? '';
  return /\.F$|\.Fe$| fe$|Female| fe /i.test(name) || /\.F$|\.Fe$| fe$|Female| fe /i.test(acronym);
}

function classifyTournamentTier(tournament: any): { aPlus: boolean; bPlus: boolean; cct: boolean } {
  const leagueName: string = tournament.league?.name ?? '';
  const serieName: string = tournament.serie?.full_name ?? '';
  const combined = `${leagueName} ${serieName}`.toLowerCase();

  const aPlus = config.aPlusTierOrganizers.some(org => combined.includes(org.toLowerCase()));
  const bPlus = config.bPlusTierOrganizers.some(org => combined.includes(org.toLowerCase()));
  const cct = config.cctTierOrganizers.some(org => combined.includes(org.toLowerCase()));

  return { aPlus, bPlus, cct };
}

export class PandaScoreSync {
  private api: AxiosInstance;
  private requestCount = 0;
  private lastResetTime = Date.now();

  constructor() {
    this.api = axios.create({
      baseURL: config.pandaScoreBaseUrl,
      headers: {
        Authorization: `Bearer ${config.pandaScoreApiKey}`,
      },
    });
  }

  /**
   * Rate limit: max ~900 requests per hour (leaving buffer from 1000 limit).
   */
  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastResetTime;
    if (elapsed > 3600_000) {
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }

    if (this.requestCount >= 900) {
      const waitTime = 3600_000 - elapsed + 1000;
      console.log(`[Sync] Rate limit reached, waiting ${Math.round(waitTime / 1000)}s`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.lastResetTime = Date.now();
    }

    this.requestCount++;
  }

  /**
   * Fetch all pages of a paginated endpoint with progress logging.
   */
  private async fetchAllPages<T>(
    endpoint: string,
    params: Record<string, any> = {},
    label?: string
  ): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      await this.throttle();
      try {
        const response = await this.api.get<T[]>(endpoint, {
          params: { ...params, page, per_page: perPage },
        });

        const data = response.data;
        all.push(...data);

        if (label && page % 5 === 0) {
          console.log(`[Sync] ${label}: fetched ${all.length} items (page ${page})...`);
        }

        if (data.length < perPage) break;
        page++;
      } catch (error: any) {
        if (error.response?.status === 429) {
          console.warn('[Sync] Rate limited, waiting 60s...');
          await new Promise(resolve => setTimeout(resolve, 60_000));
          continue; // Retry same page
        }
        console.error(`[Sync] Error fetching ${endpoint} page ${page}:`, error.message);
        break;
      }
    }

    return all;
  }

  /**
   * Clear all roster data and re-sync from scratch.
   * Needed after schema changes (e.g., adding tournament_id) to repopulate
   * with proper tournament context and prune stale player connections.
   */
  async resetAndSync(): Promise<{ teams: number; players: number; rosters: number }> {
    console.log('[Sync] Resetting roster data for clean re-sync...');
    const db = getDb();

    const rosterCount = (db.prepare('SELECT COUNT(*) as c FROM rosters').get() as any).c;
    const playerCount = (db.prepare('SELECT COUNT(*) as c FROM players').get() as any).c;

    db.exec(`
      DELETE FROM rosters;
      DELETE FROM player_tournament_counts;
    `);
    console.log(`[Sync] Cleared ${rosterCount} roster rows and tier counts (${playerCount} players kept for reference)`);

    return this.syncAll();
  }

  /**
   * Full sync: fetch teams (current rosters) + past tournaments (historical rosters).
   */
  async syncAll(): Promise<{ teams: number; players: number; rosters: number }> {
    console.log('[Sync] Starting full PandaScore sync...');
    const db = getDb();

    const insertTeam = db.prepare(`
      INSERT OR REPLACE INTO teams (id, name, acronym, image_url, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const insertPlayer = db.prepare(`
      INSERT OR REPLACE INTO players (id, name, full_name, nationality, image_url, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const insertRoster = db.prepare(`
      INSERT OR IGNORE INTO rosters (player_id, team_id, tournament_id) VALUES (?, ?, ?)
    `);

    let playerCount = 0;
    let rosterCount = 0;

    // ── Phase 1: Fetch current team rosters ──
    console.log('[Sync] Phase 1: Fetching current team rosters...');
    const teams = await this.fetchAllPages<any>('/csgo/teams', {
      sort: '-modified_at',
    }, 'Teams');

    console.log(`[Sync] Fetched ${teams.length} teams`);

    let skippedFemaleTeams = 0;
    const teamTransaction = db.transaction(() => {
      for (const team of teams) {
        if (!team.id || !team.name) continue;
        if (isFemaleTeam(team)) { skippedFemaleTeams++; continue; }
        insertTeam.run(team.id, team.name, team.acronym ?? null, team.image_url ?? null);

        if (team.players && Array.isArray(team.players)) {
          for (const player of team.players) {
            if (!player.id || !player.name) continue;
            insertPlayer.run(
              player.id,
              player.name,
              player.first_name && player.last_name
                ? `${player.first_name} ${player.last_name}`
                : null,
              player.nationality ?? null,
              player.image_url ?? null
            );
            insertRoster.run(player.id, team.id, null);
            playerCount++;
            rosterCount++;
          }
        }
      }
    });

    teamTransaction();
    console.log(`[Sync] Phase 1 complete: ${teams.length} teams (${skippedFemaleTeams} female skipped), ${playerCount} players`);

    // ── Phase 2: Fetch historical rosters from past tournaments ──
    console.log('[Sync] Phase 2: Fetching historical tournament rosters...');
    console.log('[Sync] This fetches ~7000+ tournaments to build historical player-team connections.');

    const tournaments = await this.fetchAllPages<any>(
      '/csgo/tournaments/past',
      { sort: '-begin_at' },
      'Tournaments'
    );

    console.log(`[Sync] Fetched ${tournaments.length} past tournaments. Processing rosters...`);

    let tournamentRosters = 0;

    // Track per-player tournament appearances by tier
    const playerTierCounts = new Map<number, { aPlus: Set<number>; bPlus: Set<number>; cct: Set<number> }>();

    const rosterTransaction = db.transaction(() => {
      for (const tournament of tournaments) {
        if (!tournament.expected_roster || !Array.isArray(tournament.expected_roster)) continue;

        const tier = classifyTournamentTier(tournament);

        for (const entry of tournament.expected_roster) {
          const team = entry.team;
          const players = entry.players;

          if (!team?.id || !team?.name || !Array.isArray(players)) continue;
          if (isFemaleTeam(team)) continue;

          // Upsert team
          insertTeam.run(team.id, team.name, team.acronym ?? null, team.image_url ?? null);

          for (const player of players) {
            if (!player?.id || !player?.name) continue;

            // Upsert player
            insertPlayer.run(
              player.id,
              player.name,
              player.first_name && player.last_name
                ? `${player.first_name} ${player.last_name}`
                : null,
              player.nationality ?? null,
              player.image_url ?? null
            );

            // Historical roster connection with tournament_id
            insertRoster.run(player.id, team.id, tournament.id ?? null);
            tournamentRosters++;

            // Track tier counts per player
            if (tournament.id && (tier.aPlus || tier.bPlus || tier.cct)) {
              let counts = playerTierCounts.get(player.id);
              if (!counts) {
                counts = { aPlus: new Set(), bPlus: new Set(), cct: new Set() };
                playerTierCounts.set(player.id, counts);
              }
              if (tier.aPlus) counts.aPlus.add(tournament.id);
              if (tier.bPlus) counts.bPlus.add(tournament.id);
              if (tier.cct) counts.cct.add(tournament.id);
            }
          }
        }
      }
    });

    rosterTransaction();

    // Batch upsert player tournament tier counts
    const upsertTierCount = db.prepare(`
      INSERT OR REPLACE INTO player_tournament_counts (player_id, a_plus_count, b_plus_count, cct_count)
      VALUES (?, ?, ?, ?)
    `);

    const tierTransaction = db.transaction(() => {
      for (const [playerId, counts] of playerTierCounts) {
        upsertTierCount.run(playerId, counts.aPlus.size, counts.bPlus.size, counts.cct.size);
      }
    });

    tierTransaction();
    console.log(`[Sync] Tier counts recorded for ${playerTierCounts.size} players`);
    rosterCount += tournamentRosters;

    // Count unique entries
    const uniquePlayers = (db.prepare('SELECT COUNT(*) as c FROM players').get() as any).c;
    const uniqueRosters = (db.prepare('SELECT COUNT(*) as c FROM rosters').get() as any).c;

    console.log(`[Sync] Phase 2 complete: processed ${tournaments.length} tournaments, ${tournamentRosters} roster entries`);
    console.log(`[Sync] Total unique: ${uniquePlayers} players, ${uniqueRosters} roster connections`);

    // Prune orphaned players (no roster entries after re-sync)
    const pruned = db.prepare(`
      DELETE FROM players WHERE id NOT IN (SELECT DISTINCT player_id FROM rosters)
    `).run();
    if (pruned.changes > 0) {
      console.log(`[Sync] Pruned ${pruned.changes} orphaned players with no roster entries`);
    }

    // Rebuild the graph
    playerGraph.build();

    return { teams: teams.length, players: uniquePlayers, rosters: uniqueRosters };
  }
}

export const pandaScoreSync = new PandaScoreSync();
