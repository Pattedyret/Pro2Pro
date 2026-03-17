/**
 * Quick test: fetch one team page and verify parsing works.
 * Usage: npx tsx scripts/test-liquipedia-parse.ts
 */
import 'dotenv/config';
import { LiquipediaSync } from '../src/data/sync/liquipedia';
import { parseTeamWikitext, buildYearlyRosters, filterToGap, buildGapRosters } from '../src/data/sync/liquipediaParser';

async function main() {
  const sync = new LiquipediaSync();

  // Test with MOUZ — we know gob b should appear
  console.log('=== Testing with MOUZ ===');
  const wikitext = await sync.fetchTeamWikitext('MOUZ');
  if (!wikitext) {
    console.error('Failed to fetch MOUZ page');
    return;
  }

  const changes = parseTeamWikitext(wikitext);
  console.log(`\nParsed ${changes.length} roster changes:`);
  for (const c of changes.slice(0, 30)) {
    console.log(`  ${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')} | ${c.action.padEnd(7)} | ${c.players.join(', ')} | ${c.raw.slice(0, 80)}`);
  }

  const yearlyRosters = buildYearlyRosters(changes);
  console.log('\n=== Yearly Rosters ===');
  for (const [year, players] of [...yearlyRosters].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${year}: ${[...players].join(', ')}`);
  }

  const gapRosters = buildGapRosters(changes);
  console.log('\n=== Gap Era (2012-2015) — CS:GO only ===');
  for (const [year, players] of [...gapRosters].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${year} (${[...players].length} players): ${[...players].join(', ')}`);
  }

  // Check if gob b and chrisJ appear in the same year
  for (const [year, players] of gapRosters) {
    const names = [...players].map(n => n.toLowerCase());
    if (names.some(n => n.includes('gob')) && names.some(n => n.includes('chrisj'))) {
      console.log(`\n✅ gob b and chrisJ overlap in ${year}!`);
    }
  }

  // Test player ID matching
  console.log('\n=== Player ID Matching ===');
  const testNames = ['chrisJ', 'gob b', 'NiKo', 'karrigan', 'nex', 'denis'];
  for (const name of testNames) {
    const id = sync.findPlayerId(name);
    console.log(`  ${name}: ${id ?? 'NOT FOUND'}`);
  }

  // Test team ID matching
  console.log('\n=== Team ID Matching ===');
  const testTeams = ['MOUZ', 'Natus_Vincere', 'Fnatic', 'PENTA_Sports', 'Ninjas_in_Pyjamas'];
  for (const team of testTeams) {
    const id = sync.findTeamId(team);
    console.log(`  ${team}: ${id ?? 'NOT FOUND'}`);
  }
}

main().catch(console.error);
