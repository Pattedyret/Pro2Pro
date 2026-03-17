/**
 * Liquipedia historical roster backfill.
 * Discovers CS:GO teams, fetches roster timelines, and inserts
 * missing 2012-2015 roster data to supplement PandaScore.
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { getDb } from '../db';
import { playerGraph } from '../../game/graph';
import { parseTeamWikitext, buildGapRosters } from './liquipediaParser';

const CACHE_DIR = path.join(process.cwd(), 'data', 'liquipedia-cache');
const REQUEST_DELAY_MS = 5000;

// Synthetic tournament IDs start at -1 and go down
// Format: -(teamHash * 100 + yearOffset) to keep them unique
const SYNTHETIC_ID_BASE = -100000;

// Known mappings: Liquipedia page title -> PandaScore team acronym/name
const TEAM_NAME_MAPPINGS: Record<string, string[]> = {
  'Natus_Vincere': ['NAVI', 'Natus Vincere'],
  'MOUZ': ['MOUZ', 'mousesports'],
  'Ninjas_in_Pyjamas': ['NIP', 'Ninjas in Pyjamas'],
  'Fnatic': ['FNC', 'fnatic'],
  'Virtus.pro': ['VP', 'Virtus.pro'],
  'Team_Liquid': ['TL', 'Team Liquid'],
  'Astralis': ['AST', 'Astralis'],
  'G2_Esports': ['G2', 'G2 Esports'],
  'FaZe_Clan': ['FaZe', 'FaZe Clan'],
  'Cloud9': ['C9', 'Cloud9'],
  'Team_EnVyUs': ['ENVY', 'Envy', 'Team EnVyUs'],
  'Luminosity_Gaming': ['LG', 'Luminosity Gaming', 'Luminosity'],
  'SK_Gaming': ['SK', 'SK Gaming'],
  'Counter_Logic_Gaming': ['CLG', 'Counter Logic Gaming'],
  'Complexity_Gaming': ['COL', 'compLexity', 'Complexity Gaming'],
  'Team_SoloMid': ['TSM', 'Team SoloMid'],
  'Copenhagen_Wolves': ['CPW', 'Copenhagen Wolves'],
  'HellRaisers': ['HR', 'HellRaisers'],
  'FlipSid3_Tactics': ['F3', 'Flipsid3', 'FlipSid3 Tactics'],
  'Titan_(French_team)': ['Titan'],
  'LDLC.com': ['LDLC'],
  'Team_Dignitas': ['DIG', 'Dignitas', 'Team Dignitas'],
  'Gambit_Gaming': ['GMB', 'Gambit', 'Gambit Gaming'],
  'North': ['North'],
  'OpTic_Gaming': ['OpTic', 'OpTic Gaming'],
  'Renegades': ['RNG', 'Renegades'],
  'MIBR': ['MIBR'],
  'BIG': ['BIG'],
  'NRG_Esports': ['NRG', 'NRG Esports'],
  'Heroic': ['HERO', 'Heroic'],
  'ENCE': ['ENCE'],
  'Vega_Squadron': ['Vega', 'Vega Squadron'],
  'Space_Soldiers': ['SS', 'Space Soldiers'],
  'PENTA_Sports': ['PENTA', 'PENTA Sports'],
  'Sprout': ['Sprout'],
  'Team_ALTERNATE': ['ATN', 'ALTERNATE', 'Team ALTERNATE'],
  'Planetkey_Dynamics': ['PkD', 'Planetkey Dynamics'],
  'Team_Kinguin': ['Kinguin', 'Team Kinguin'],
  'Team_eBettle': ['eBettle', 'Team eBettle'],
  'Vox_Eminor': ['VoX', 'Vox Eminor'],
  'Immunity': ['IMM', 'Immunity'],
  'Chiefs_Esports_Club': ['Chiefs'],
  'Team_Immunity': ['IMM', 'Team Immunity'],
  'iBUYPOWER': ['iBP', 'iBUYPOWER'],
  'NetcodeGuides.com': ['NCG', 'NetcodeGuides'],
  'Denial_eSports': ['dNi', 'Denial'],
  'Nihilum': ['Nihilum'],
  'Winterfox': ['WFX', 'Winterfox'],
  'Team_Liquid_Academy': ['TLA'],
  'Mousesports': ['MOUZ', 'mousesports'],
  'Method_(North_American_team)': ['Method'],
  'Bravado_Gaming': ['Bravado'],
  'Energy_eSports': ['Energy'],
  'KaBuM!_e-Sports': ['KaBuM'],
  'Games_Academy': ['GA', 'Games Academy'],
  'KeyD_Stars': ['KeyD'],
  'Tempo_Storm': ['TS', 'Tempo Storm'],
  'Immortals': ['IMT', 'Immortals'],
  'LGB_eSports': ['LGB'],
  'London_Conspiracy': ['LC', 'London Conspiracy'],
  'Titan': ['Titan'],
  'Clan-Mystik': ['Mystik', 'Clan-Mystik'],
  'VeryGames': ['VG', 'VeryGames'],
  'Western_Wolves': ['WW', 'Western Wolves'],
  'Team_LDLC.com': ['LDLC'],
  'Epsilon_eSports': ['Epsilon'],
  'Property': ['Property'],
  'Publiclir.se': ['pub'],
  'Recursive_eSports': ['RCS', 'Recursive'],
  'Reason_Gaming': ['Reason'],
  'Xapso': ['Xapso'],
  'dAT_team': ['dAT'],
  'myXMG': ['myXMG'],
  'CPHW': ['CPHW', 'Copenhagen Wolves'],
  'Natus Vincere': ['NAVI', 'Natus Vincere'],
};

export class LiquipediaSync {
  private api: AxiosInstance;
  private lastRequestTime = 0;

  constructor() {
    this.api = axios.create({
      baseURL: 'https://liquipedia.net/counterstrike/api.php',
      headers: {
        'User-Agent': 'Pro2Pro-Bot/1.0 (CS:GO connection game; respectful scraping; contact: github.com/pro2pro)',
        'Accept-Encoding': 'gzip',
      },
    });

    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  /** Respect rate limits — wait at least 5 seconds between requests */
  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < REQUEST_DELAY_MS) {
      const wait = REQUEST_DELAY_MS - elapsed;
      await new Promise(resolve => setTimeout(resolve, wait));
    }
    this.lastRequestTime = Date.now();
  }

  /** Get cached response or return null */
  private getCache(key: string): string | null {
    const filePath = path.join(CACHE_DIR, `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  }

  /** Save response to cache */
  private setCache(key: string, data: string): void {
    const filePath = path.join(CACHE_DIR, `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
    fs.writeFileSync(filePath, data, 'utf-8');
  }

  /**
   * Discover all team page titles from Liquipedia's Teams category.
   */
  async discoverTeams(): Promise<string[]> {
    const cacheKey = 'category_teams_all';
    const cached = this.getCache(cacheKey);
    if (cached) {
      console.log('[Liquipedia] Using cached team list');
      return JSON.parse(cached);
    }

    console.log('[Liquipedia] Discovering teams from category...');
    const allTeams: string[] = [];
    let cmcontinue: string | undefined;

    while (true) {
      await this.throttle();
      const params: Record<string, string> = {
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:Teams',
        cmlimit: '500',
        cmtype: 'page',
        format: 'json',
      };
      if (cmcontinue) params.cmcontinue = cmcontinue;

      try {
        const resp = await this.api.get('', { params });
        const members = resp.data?.query?.categorymembers ?? [];
        for (const m of members) {
          allTeams.push(m.title);
        }
        console.log(`[Liquipedia] Fetched ${allTeams.length} teams so far...`);

        cmcontinue = resp.data?.continue?.cmcontinue;
        if (!cmcontinue) break;
      } catch (err: any) {
        console.error(`[Liquipedia] Error fetching category:`, err.message);
        break;
      }
    }

    this.setCache(cacheKey, JSON.stringify(allTeams));
    console.log(`[Liquipedia] Discovered ${allTeams.length} total teams`);
    return allTeams;
  }

  /**
   * Fetch a team's wikitext from Liquipedia (with caching).
   */
  async fetchTeamWikitext(pageTitle: string): Promise<string | null> {
    const cacheKey = `team_${pageTitle}`;
    const cached = this.getCache(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed.wikitext ?? null;
    }

    await this.throttle();
    try {
      const resp = await this.api.get('', {
        params: {
          action: 'parse',
          page: pageTitle,
          prop: 'wikitext',
          format: 'json',
        },
      });

      const wikitext = resp.data?.parse?.wikitext?.['*'] ?? null;
      this.setCache(cacheKey, JSON.stringify({ wikitext }));
      return wikitext;
    } catch (err: any) {
      if (err.response?.status === 429) {
        console.warn(`[Liquipedia] Rate limited on ${pageTitle}, waiting 30s...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        return this.fetchTeamWikitext(pageTitle); // retry once
      }
      console.error(`[Liquipedia] Error fetching ${pageTitle}:`, err.message);
      return null;
    }
  }

  /**
   * Look up a PandaScore team ID by matching various name forms.
   */
  findTeamId(pageTitle: string): number | null {
    const db = getDb();
    const cleanTitle = pageTitle
      .replace(/_/g, ' ')
      .replace(/\s*\(.*?\)\s*/g, '') // remove disambiguation like (French team)
      .trim();

    // Check manual mappings
    const mappings = TEAM_NAME_MAPPINGS[pageTitle] ?? TEAM_NAME_MAPPINGS[cleanTitle] ?? [];
    for (const alias of [...mappings, cleanTitle]) {
      // Try acronym match
      const byAcronym = db.prepare('SELECT id FROM teams WHERE acronym = ? COLLATE NOCASE').get(alias) as any;
      if (byAcronym) return byAcronym.id;

      // Try name match
      const byName = db.prepare('SELECT id FROM teams WHERE name = ? COLLATE NOCASE').get(alias) as any;
      if (byName) return byName.id;

      // Try partial name match
      const byPartial = db.prepare('SELECT id FROM teams WHERE name LIKE ? COLLATE NOCASE').get(`%${alias}%`) as any;
      if (byPartial) return byPartial.id;
    }

    return null;
  }

  /**
   * Look up a PandaScore player ID by name.
   */
  findPlayerId(playerName: string): number | null {
    const db = getDb();

    // Exact match (case-insensitive)
    const exact = db.prepare('SELECT id FROM players WHERE name = ? COLLATE NOCASE').get(playerName) as any;
    if (exact) return exact.id;

    // Try without spaces/special chars
    const normalized = playerName.replace(/[\s\-_.]/g, '').toLowerCase();
    const all = db.prepare('SELECT id, name FROM players').all() as any[];
    for (const p of all) {
      if (p.name.replace(/[\s\-_.]/g, '').toLowerCase() === normalized) {
        return p.id;
      }
    }

    return null;
  }

  /**
   * Run the full backfill process.
   */
  async backfill(): Promise<{
    teamsProcessed: number;
    teamsMatched: number;
    rostersInserted: number;
    playersCreated: number;
    playersMatched: number;
    errors: string[];
  }> {
    const db = getDb();
    const errors: string[] = [];
    let teamsProcessed = 0;
    let teamsMatched = 0;
    let rostersInserted = 0;
    let playersCreated = 0;
    let playersMatched = 0;
    let nextSyntheticPlayerId = -100000;
    let nextSyntheticTeamId = -100000;
    let syntheticTournamentCounter = 0;

    // Pre-load player name index for faster lookups
    const playerNameIndex = new Map<string, number>();
    const allPlayers = db.prepare('SELECT id, name FROM players').all() as any[];
    for (const p of allPlayers) {
      playerNameIndex.set(p.name.toLowerCase(), p.id);
      // Also index without special chars
      playerNameIndex.set(p.name.replace(/[\s\-_.]/g, '').toLowerCase(), p.id);
    }

    const insertPlayer = db.prepare(`
      INSERT OR IGNORE INTO players (id, name, nationality, updated_at)
      VALUES (?, ?, NULL, CURRENT_TIMESTAMP)
    `);
    const insertTeam = db.prepare(`
      INSERT OR IGNORE INTO teams (id, name, acronym, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const insertRoster = db.prepare(`
      INSERT OR IGNORE INTO rosters (player_id, team_id, tournament_id)
      VALUES (?, ?, ?)
    `);

    // Fast player lookup using in-memory index
    function findPlayerFast(name: string): number | null {
      const lower = name.toLowerCase();
      if (playerNameIndex.has(lower)) return playerNameIndex.get(lower)!;
      const normalized = name.replace(/[\s\-_.]/g, '').toLowerCase();
      if (playerNameIndex.has(normalized)) return playerNameIndex.get(normalized)!;
      return null;
    }

    // Discover all teams
    const teamPages = await this.discoverTeams();
    console.log(`[Liquipedia] Processing ${teamPages.length} team pages...`);

    for (const pageTitle of teamPages) {
      teamsProcessed++;

      if (teamsProcessed % 50 === 0) {
        console.log(`[Liquipedia] Progress: ${teamsProcessed}/${teamPages.length} teams | ${rostersInserted} rosters | ${playersMatched} matched | ${playersCreated} created`);
      }

      // Fetch wikitext
      const wikitext = await this.fetchTeamWikitext(pageTitle);
      if (!wikitext) continue;

      // Parse roster changes
      const changes = parseTeamWikitext(wikitext);
      if (changes.length === 0) continue;

      // Build yearly rosters for the CS:GO gap era (2012-2015) only
      const gapRosters = buildGapRosters(changes);
      if (gapRosters.size === 0) continue;

      // Find team ID
      let teamId = this.findTeamId(pageTitle);
      if (!teamId) {
        // Create synthetic team
        teamId = nextSyntheticTeamId--;
        const cleanName = pageTitle.replace(/_/g, ' ').replace(/\s*\(.*?\)\s*/g, '').trim();
        insertTeam.run(teamId, cleanName, cleanName.slice(0, 10));
      }
      teamsMatched++;

      // Process each year
      for (const [year, playerNames] of gapRosters) {
        syntheticTournamentCounter++;
        const syntheticTournamentId = SYNTHETIC_ID_BASE - syntheticTournamentCounter;

        const playerIds: number[] = [];

        for (const name of playerNames) {
          let playerId = findPlayerFast(name);

          if (!playerId) {
            // Create synthetic player
            playerId = nextSyntheticPlayerId--;
            insertPlayer.run(playerId, name);
            playerNameIndex.set(name.toLowerCase(), playerId);
            playerNameIndex.set(name.replace(/[\s\-_.]/g, '').toLowerCase(), playerId);
            playersCreated++;
          } else {
            playersMatched++;
          }

          playerIds.push(playerId);
        }

        // Insert roster entries — all players on this team in this year
        const transaction = db.transaction(() => {
          for (const pid of playerIds) {
            insertRoster.run(pid, teamId, syntheticTournamentId);
            rostersInserted++;
          }
        });
        transaction();
      }
    }

    // Rebuild the graph with new data
    console.log('[Liquipedia] Rebuilding player graph...');
    playerGraph.build();

    return {
      teamsProcessed,
      teamsMatched,
      rostersInserted,
      playersCreated,
      playersMatched,
      errors,
    };
  }
}

export const liquipediaSync = new LiquipediaSync();
