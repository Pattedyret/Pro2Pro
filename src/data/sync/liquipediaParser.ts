/**
 * Parser for Liquipedia team page wikitext.
 * Extracts roster changes from Timeline sections and builds yearly roster snapshots.
 */

export interface RosterChange {
  year: number;
  month: number;
  day: number;
  players: string[];     // player names extracted from [[links]]
  action: 'join' | 'leave' | 'unknown';
  raw: string;           // original text for debugging
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Known non-player link targets to skip.
 * These are orgs, sites, tournaments, etc. that appear in [[links]] in roster change lines.
 */
const NON_PLAYER_PATTERNS = [
  // Orgs / sites
  /esports?$/i, /gaming$/i, /\bgaming\b/i, /\besport/i,
  /hltv/i, /fragbite/i, /vakarm/i, /readmore/i, /99damage/i,
  /counterstrike\.de/i, /esreality/i, /\bESEA\b/, /\bFACEIT\b/i,
  /\.com$/i, /\.de$/i, /\.se$/i, /\.org$/i, /\.net$/i,
  // Tournament / event terms
  /tournament/i, /league/i, /major/i, /qualifier/i, /season/i,
  /championship/i, /invitational/i, /masters/i, /premier/i,
  /intel.extreme/i, /dreamhack/i, /starladder/i, /esl/i,
  // Team-like patterns (multi-word team names, orgs)
  /^team\s/i, /\bteam$/i, /\bacademy$/i, /\broster$/i,
  /\bclan$/i, /\battax$/i, /\brebels$/i, /\bdynamics$/i,
  /\benterprises$/i, /\bsports$/i,
  // Known orgs that appear as links
  /^fnatic$/i, /^natus vincere$/i, /^virtus\.pro$/i, /^cloud9$/i,
  /^ninjas in pyjamas$/i, /^g2$/i, /^faze clan$/i, /^astralis$/i,
  /^north$/i, /^optic$/i, /^renegades$/i, /^mibr$/i, /^ence$/i,
  /^big$/i, /^nrg$/i, /^heroic$/i, /^sprout$/i, /^mouz$/i,
  /^mousesports$/i, /^complexity$/i, /^liquid$/i, /^envy$/i,
  /^dignitas$/i, /^gambit$/i, /^hellraisers$/i, /^penta$/i,
  /^alternate$/i, /^immortals$/i, /^luminosity$/i, /^sk$/i,
  /^counter-strike$/i, /^counter strike$/i,
  // Reference / citation patterns
  /^cite\s/i, /^ref\s/i,
];

// Known team page titles that get linked from roster changes
const KNOWN_TEAM_LINKS = new Set([
  'infernum', 'a-losers', 'n!faculty', 'g7 teams', 'dkh', 'team64',
  'partydaddlers', 'team xXx', 'team alternate', 'alternate attax',
  'planetkey dynamics', 'berzerk', 'ination', 'team ebettle', 'team kinguin',
  'flipsid3', 'gamers2', 'london conspiracy', 'lgb', 'property', 'publiclir.se',
  'recursive', 'reason gaming', 'xapso', 'dat team', 'myxmg', 'cphw',
  'copenhagen wolves', 'western wolves', 'verygames', 'clan-mystik',
  'epsilon', 'ldlc', 'titan', '3dmax', 'kabum', 'keyd', 'games academy',
  'tempo storm', 'vox eminor', 'immunity', 'chiefs', 'bravado',
  'denial', 'nihilum', 'winterfox', 'netcodeguides', 'ibuypower',
  'method', 'ex-method', 'nochance', 'mad lions', 'funplus phoenix',
  'apeks rebels', 'apeks', 'mouz nxt', 'gamerlegion', '00 nation',
  'team bavarian heaven', 'e-stro', 'team vitality', 'team liquid',
  'penta sports', 'space soldiers', 'vega squadron',
].map(s => s.toLowerCase()));

/**
 * Extract player names from wikitext [[links]].
 * Handles [[PlayerName]] and [[PlayerName|DisplayName]] formats.
 * Aggressively filters out teams, orgs, sites, and other non-player links.
 */
function extractPlayerLinks(text: string): string[] {
  // First, strip <ref>...</ref> blocks and {{cite...}} templates to avoid
  // picking up author names, site names from citations
  const cleaned = text
    .replace(/<ref[^>]*>.*?<\/ref>/gs, '')
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/\{\{cite[^}]*\}\}/gi, '');

  const players: string[] = [];
  const linkRegex = /\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]/g;
  let match;

  while ((match = linkRegex.exec(cleaned)) !== null) {
    const target = match[1].trim();
    const display = match[2]?.trim();
    const name = display ?? target;

    // Skip structural wiki links
    if (target.includes(':') || target.includes('/') ||
        target.startsWith('Category') || target.startsWith('File') ||
        target.startsWith('Template')) continue;

    // Skip known team links
    if (KNOWN_TEAM_LINKS.has(name.toLowerCase()) ||
        KNOWN_TEAM_LINKS.has(target.toLowerCase())) continue;

    // Skip non-player patterns
    if (NON_PLAYER_PATTERNS.some(p => p.test(name) || p.test(target))) continue;

    // Skip if the link target contains "(team)" disambiguation
    if (/\(.*team.*\)/i.test(target)) continue;

    // Player names are typically short (1-20 chars), no spaces in most cases
    // (though some have spaces like "gob b"). Skip very long names.
    if (name.length > 25) continue;

    players.push(name);
  }

  return players;
}

/**
 * Determine if a roster change line describes players joining or leaving.
 */
function classifyAction(text: string): 'join' | 'leave' | 'unknown' {
  const lower = text.toLowerCase();

  // Join indicators
  const joinPatterns = [
    /\bjoins?\b/, /\bsigns?\b/, /\bacquire[sd]?\b/, /\bbring[s]?\s+in\b/,
    /\bpick[s]?\s+up\b/, /\bformed\s+with\b/, /\broster\s+acquired\b/,
    /\badds?\b/, /\brecruits?\b/, /\btransfer(?:red|s)?\s+(?:to|from)\b/,
    /\broster\b.*\bsign/, /\bwelcome[sd]?\b/, /\bannounce[sd]?\b.*\baddition\b/,
    /\breplac(?:es?|ing)\b/, // "X replaces Y" means X joined
  ];

  // Leave indicators
  const leavePatterns = [
    /\bleaves?\b/, /\bleft\b/, /\breleased?\b/, /\bdepart(?:s|ed|ure)?\b/,
    /\bpart(?:s|ed)?\s+ways?\b/, /\bbenched\b/, /\bremoved?\b/,
    /\bdropped?\b/, /\bkicked?\b/, /\bdisbands?\b/, /\bstep(?:s|ped)?\s+down\b/,
    /\bretires?\b/, /\binactive\b/, /\blet\s+go\b/,
  ];

  const hasJoin = joinPatterns.some(p => p.test(lower));
  const hasLeave = leavePatterns.some(p => p.test(lower));

  // Lines with both join and leave (e.g. "X replaces Y") — treat as mixed
  // The player extraction will handle this based on context
  if (hasJoin && !hasLeave) return 'join';
  if (hasLeave && !hasJoin) return 'leave';
  if (hasJoin && hasLeave) return 'join'; // "X replaces Y" — primary action is join

  return 'unknown';
}

/**
 * Parse the full wikitext of a team page into roster changes.
 */
export function parseTeamWikitext(wikitext: string): RosterChange[] {
  const changes: RosterChange[] = [];

  // Extract the Timeline section
  // Liquipedia uses {{Tabs dynamic}} with |nameN=YEAR and |contentN= blocks.
  // First, build a map of tab index -> year from |nameN=YEAR patterns,
  // then detect year switches when |contentN= appears.

  // Build year map from |nameN=YEAR patterns
  const yearMap = new Map<number, number>();
  const nameRegex = /\|name(\d+)\s*=\s*(\d{4})/g;
  let nameMatch;
  while ((nameMatch = nameRegex.exec(wikitext)) !== null) {
    yearMap.set(parseInt(nameMatch[1]), parseInt(nameMatch[2]));
  }

  let currentYear = 0;

  // Split by lines
  const lines = wikitext.split('\n');

  for (const line of lines) {
    // Detect year context from various formats:
    // |contentN= — look up year from yearMap
    const contentMatch = line.match(/\|content(\d+)\s*=/);
    if (contentMatch) {
      const tabIdx = parseInt(contentMatch[1]);
      if (yearMap.has(tabIdx)) {
        currentYear = yearMap.get(tabIdx)!;
      }
      continue;
    }

    // Also handle: {{Tabs dynamic/tab|title=2015}} or ====2015==== or similar
    const yearMatch = line.match(/(?:title\s*=\s*|={3,4}\s*)(\d{4})\b/);
    if (yearMatch) {
      currentYear = parseInt(yearMatch[1]);
      continue;
    }

    // Process bullet points (roster change entries)
    if (!line.trim().startsWith('*')) continue;
    if (currentYear === 0) continue;

    const text = line.replace(/^\*+\s*/, '').trim();
    if (!text) continue;

    // Extract date
    const dateMatch = text.match(/^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?/i);
    let month = 1, day = 1;
    if (dateMatch) {
      const monthName = dateMatch[1].toLowerCase();
      if (MONTHS[monthName]) {
        month = MONTHS[monthName];
        day = parseInt(dateMatch[2]);
      }
    }

    // Extract player names from [[links]]
    const players = extractPlayerLinks(text);
    if (players.length === 0) continue;

    // Classify action
    const action = classifyAction(text);

    changes.push({
      year: currentYear,
      month,
      day,
      players,
      action,
      raw: text.slice(0, 200),
    });
  }

  return changes;
}

/**
 * Build yearly roster snapshots from roster changes.
 * Returns a map of year -> set of player names who were on the team that year.
 *
 * Strategy: track a running roster, and for each year record all players
 * who were part of the roster at any point during that year.
 */
export function buildYearlyRosters(changes: RosterChange[]): Map<number, Set<string>> {
  const yearlyRosters = new Map<number, Set<string>>();
  const currentRoster = new Set<string>();

  // Sort changes chronologically
  const sorted = [...changes].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  });

  // Find the range of years
  if (sorted.length === 0) return yearlyRosters;
  const minYear = sorted[0].year;
  const maxYear = sorted[sorted.length - 1].year;

  let changeIdx = 0;

  for (let year = minYear; year <= maxYear; year++) {
    // Process all changes for this year
    while (changeIdx < sorted.length && sorted[changeIdx].year === year) {
      const change = sorted[changeIdx];

      if (change.action === 'join' || change.action === 'unknown') {
        for (const player of change.players) {
          currentRoster.add(player);
        }
      } else if (change.action === 'leave') {
        for (const player of change.players) {
          currentRoster.delete(player);
        }
      }

      changeIdx++;
    }

    // Record everyone who was on the roster this year
    if (currentRoster.size > 0) {
      yearlyRosters.set(year, new Set(currentRoster));
    }
  }

  // Also backfill: players present at the start of the first change year
  // were probably on the team. The first "join" entries often represent
  // the initial roster formation — those players should be in the year they joined.
  // This is handled by the logic above since "join" adds them to currentRoster.

  return yearlyRosters;
}

/**
 * Build yearly rosters for the CS:GO gap era only (2012-2015).
 * Starts fresh at 2012 — ignores pre-CS:GO roster history to avoid
 * accumulating 1.6/Source era players into the CS:GO roster.
 */
export function buildGapRosters(changes: RosterChange[]): Map<number, Set<string>> {
  const yearlyRosters = new Map<number, Set<string>>();
  const currentRoster = new Set<string>(); // start fresh for CS:GO era

  // Only process changes from 2012-2015
  const gapChanges = changes
    .filter(c => c.year >= 2012 && c.year <= 2015)
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    });

  if (gapChanges.length === 0) return yearlyRosters;

  let lastYear = gapChanges[0].year;

  for (const change of gapChanges) {
    // Record roster snapshot when year changes
    if (change.year !== lastYear) {
      if (currentRoster.size > 0) {
        yearlyRosters.set(lastYear, new Set(currentRoster));
      }
      lastYear = change.year;
    }

    if (change.action === 'join' || change.action === 'unknown') {
      for (const player of change.players) {
        currentRoster.add(player);
      }
    } else if (change.action === 'leave') {
      for (const player of change.players) {
        currentRoster.delete(player);
      }
    }
  }

  // Record final year
  if (currentRoster.size > 0) {
    yearlyRosters.set(lastYear, new Set(currentRoster));
  }

  return yearlyRosters;
}

/**
 * Filter yearly rosters to only include the 2012-2015 CS:GO era
 * (the gap not covered by PandaScore).
 */
export function filterToGap(yearlyRosters: Map<number, Set<string>>): Map<number, Set<string>> {
  const filtered = new Map<number, Set<string>>();
  for (const [year, players] of yearlyRosters) {
    if (year >= 2012 && year <= 2015) {
      filtered.set(year, players);
    }
  }
  return filtered;
}
