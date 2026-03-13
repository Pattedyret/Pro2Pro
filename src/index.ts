import { config } from './config';
import { client, registerCommands } from './bot/client';
import { handleInteraction } from './bot/interactions/handler';
import { getDb, closeDb } from './data/db';
import { playerGraph } from './game/graph';
import { pandaScoreSync } from './data/sync/pandaScore';
import { startScheduler, generateAndPostDailyPuzzle } from './scheduler/daily';

async function main(): Promise<void> {
  console.log('[Pro2Pro] Starting...');

  // Validate required env vars
  if (!config.discordToken) {
    console.error('[Pro2Pro] DISCORD_TOKEN is required! Set it in .env');
    process.exit(1);
  }

  if (!config.pandaScoreApiKey) {
    console.error('[Pro2Pro] PANDASCORE_API_KEY is required! Set it in .env');
    process.exit(1);
  }

  // Initialize database
  console.log('[Pro2Pro] Initializing database...');
  getDb();

  // Initial data sync (if DB is empty) or full re-sync if --resync flag is passed
  const db = getDb();
  const playerCount = (db.prepare('SELECT COUNT(*) as count FROM players').get() as any).count;
  const forceResync = process.argv.includes('--resync');

  if (forceResync) {
    console.log('[Pro2Pro] --resync flag detected. Clearing roster data and re-syncing from scratch...');
    console.log('[Pro2Pro] This will take several minutes...');
    await pandaScoreSync.resetAndSync();
  } else if (playerCount === 0) {
    console.log('[Pro2Pro] Database is empty, running initial sync...');
    console.log('[Pro2Pro] This may take several minutes on first run...');
    await pandaScoreSync.syncAll();
  } else {
    console.log(`[Pro2Pro] Found ${playerCount} players in database`);
    playerGraph.build();
  }

  console.log(`[Pro2Pro] Graph: ${playerGraph.nodeCount} players, ${playerGraph.edgeCount} connections`);

  // Register slash commands
  await registerCommands();

  // Set up event handlers
  client.on('ready', () => {
    console.log(`[Pro2Pro] Bot logged in as ${client.user?.tag}`);
    console.log(`[Pro2Pro] Serving ${client.guilds.cache.size} servers`);

    // Start scheduled jobs
    startScheduler();

    // Generate today's puzzle if it doesn't exist
    generateAndPostDailyPuzzle().catch(err => {
      console.error('[Pro2Pro] Failed to generate daily puzzle:', err);
    });
  });

  client.on('interactionCreate', handleInteraction);

  // Login
  await client.login(config.discordToken);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[Pro2Pro] Shutting down...');
  closeDb();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[Pro2Pro] Shutting down...');
  closeDb();
  client.destroy();
  process.exit(0);
});

main().catch(err => {
  console.error('[Pro2Pro] Fatal error:', err);
  process.exit(1);
});
