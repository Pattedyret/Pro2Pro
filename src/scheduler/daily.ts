import cron from 'node-cron';
import { client } from '../bot/client';
import { config } from '../config';
import { generatePuzzle, getTodayDifficulty, getNextPuzzleNumber } from '../game/puzzleGenerator';
import { savePuzzle, getTodayPuzzle, getPreviousPuzzle } from '../data/models/puzzle';
import { getDb } from '../data/db';
import { createPuzzleEmbed } from '../bot/interactions/gameEmbed';
import { pandaScoreSync } from '../data/sync/pandaScore';
import { playerGraph } from '../game/graph';

let puzzleChannelId: string | null = null;

/**
 * Set the channel ID where daily puzzles will be posted.
 */
export function setPuzzleChannel(channelId: string): void {
  puzzleChannelId = channelId;
  console.log(`[Scheduler] Puzzle channel set to: ${channelId}`);
}

/**
 * Start all scheduled jobs.
 */
export function startScheduler(): void {
  // Daily puzzle at 07:00 UTC (08:00 CET)
  cron.schedule(config.dailyPuzzleCron, async () => {
    console.log('[Scheduler] Running daily puzzle generation...');
    await generateAndPostDailyPuzzle();
  });

  // Data sync every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Scheduler] Running data sync...');
    try {
      await pandaScoreSync.syncAll();
    } catch (error) {
      console.error('[Scheduler] Sync failed:', error);
    }
  });

  console.log('[Scheduler] Scheduled jobs started');
}

/**
 * Generate today's puzzle and post it to the configured channel.
 */
export async function generateAndPostDailyPuzzle(): Promise<void> {
  // Check if today's puzzle already exists
  const existing = getTodayPuzzle();
  if (existing) {
    console.log('[Scheduler] Today\'s puzzle already exists');
    return;
  }

  const puzzleNumber = getNextPuzzleNumber();
  const difficulty = getTodayDifficulty(puzzleNumber);

  console.log(`[Scheduler] Generating puzzle #${puzzleNumber} (${difficulty})...`);

  const generated = generatePuzzle(difficulty);
  if (!generated) {
    console.error('[Scheduler] Failed to generate puzzle!');
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  const puzzle = savePuzzle({
    puzzle_number: puzzleNumber,
    date: today,
    start_player_id: generated.startPlayerId,
    end_player_id: generated.endPlayerId,
    optimal_path_length: generated.optimalPathLength,
    num_valid_paths: generated.numValidPaths,
    difficulty: generated.difficulty,
  });

  const startPlayer = playerGraph.getPlayer(generated.startPlayerId);
  const endPlayer = playerGraph.getPlayer(generated.endPlayerId);
  console.log(
    `[Scheduler] Puzzle #${puzzleNumber}: ${startPlayer?.name} -> ${endPlayer?.name} ` +
    `(${generated.optimalPathLength} steps, ${generated.numValidPaths} paths, ${difficulty})`
  );

  // Post to channel with notification for previous daily players
  if (puzzleChannelId) {
    try {
      const channel = await client.channels.fetch(puzzleChannelId);
      if (channel && channel.isTextBased() && 'send' in channel) {
        // Find users who played the previous daily to notify them
        let pingLine = '';
        const prevPuzzle = getPreviousPuzzle();
        if (prevPuzzle) {
          const db = getDb();
          const prevPlayers = db.prepare(
            'SELECT DISTINCT discord_user_id FROM user_attempts WHERE puzzle_id = ?'
          ).all(prevPuzzle.id) as { discord_user_id: string }[];
          if (prevPlayers.length > 0) {
            const mentions = prevPlayers.map(p => `<@${p.discord_user_id}>`).join(' ');
            pingLine = `\n${mentions}`;
          }
        }

        const { embed, rows } = createPuzzleEmbed(puzzle);
        await channel.send({
          content: `\uD83C\uDFAF **New Pro2Pro Daily Puzzle!** Use \`/pro2pro play\` to play.${pingLine}`,
          embeds: [embed],
        });
        console.log('[Scheduler] Puzzle posted to channel');
      }
    } catch (error) {
      console.error('[Scheduler] Failed to post puzzle:', error);
    }
  }
}
