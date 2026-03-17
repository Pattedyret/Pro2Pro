/**
 * One-time script to backfill historical CS:GO roster data (2012-2015)
 * from Liquipedia to supplement PandaScore data.
 *
 * Usage: npx tsx scripts/backfill-liquipedia.ts
 *
 * This script:
 * 1. Discovers all CS:GO teams from Liquipedia's category system
 * 2. Fetches each team's roster timeline from their wiki page
 * 3. Parses roster changes (joins/leaves) with dates
 * 4. Builds yearly roster snapshots for 2012-2015
 * 5. Maps players to existing PandaScore player IDs
 * 6. Inserts missing connections into the database
 * 7. Rebuilds the player graph
 *
 * Rate limiting: 5 seconds between requests, all responses cached locally.
 * Safe to re-run — uses INSERT OR IGNORE.
 */

import 'dotenv/config';
import { liquipediaSync } from '../src/data/sync/liquipedia';

async function main() {
  console.log('=== Liquipedia Historical Roster Backfill ===');
  console.log('Backfilling CS:GO roster data for 2012-2015 (pre-PandaScore era)');
  console.log('Rate limit: 5 seconds between API requests');
  console.log('All responses are cached locally in data/liquipedia-cache/');
  console.log('');

  const startTime = Date.now();

  try {
    const result = await liquipediaSync.backfill();

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log('');
    console.log('=== Backfill Complete ===');
    console.log(`Time: ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
    console.log(`Teams processed: ${result.teamsProcessed}`);
    console.log(`Teams with gap-era data: ${result.teamsMatched}`);
    console.log(`Roster entries inserted: ${result.rostersInserted}`);
    console.log(`Players matched to PandaScore: ${result.playersMatched}`);
    console.log(`New players created: ${result.playersCreated}`);

    if (result.errors.length > 0) {
      console.log(`\nErrors (${result.errors.length}):`);
      for (const err of result.errors.slice(0, 20)) {
        console.log(`  - ${err}`);
      }
    }
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

main();
