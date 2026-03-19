import { getDb } from '../data/db';
import { config } from '../config';
import { playerGraph } from './graph';
import { findShortestPath, countShortestPaths } from './pathfinder';

export interface GeneratedPuzzle {
  startPlayerId: number;
  endPlayerId: number;
  optimalPathLength: number;
  numValidPaths: number;
  difficulty: string;
}

/**
 * Generate a daily puzzle for the given difficulty tier.
 */
export function generatePuzzle(difficulty: keyof typeof config.difficulty): GeneratedPuzzle | null {
  const tier = config.difficulty[difficulty];
  // Daily puzzles also use famous players — fall back to notable only if needed
  let famousPlayers = playerGraph.getFamousPlayerIds();
  if (famousPlayers.length < 20) famousPlayers = playerGraph.getNotablePlayerIds();

  if (famousPlayers.length < 20) {
    console.error('[PuzzleGen] Not enough famous/notable players to generate puzzle');
    return null;
  }

  const db = getDb();

  // Get recently used player pairs to avoid repeats
  const recentPairs = new Set<string>();
  const recentRows = db.prepare(`
    SELECT start_player_id, end_player_id FROM daily_puzzles
    WHERE date > date('now', '-${config.puzzleRepeatDays} days')
  `).all() as any[];

  for (const row of recentRows) {
    recentPairs.add(`${row.start_player_id}-${row.end_player_id}`);
    recentPairs.add(`${row.end_player_id}-${row.start_player_id}`);
  }

  // Try random pairs until we find a valid puzzle
  const maxAttempts = 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const startId = famousPlayers[Math.floor(Math.random() * famousPlayers.length)];
    const endId = famousPlayers[Math.floor(Math.random() * famousPlayers.length)];

    if (startId === endId) continue;

    // Check not recently used
    if (recentPairs.has(`${startId}-${endId}`)) continue;

    // Find shortest path
    const result = findShortestPath(startId, endId);
    if (!result) continue;

    // Check path length fits difficulty tier
    if (result.length < tier.minPath || result.length > tier.maxPath) continue;

    // Count distinct shortest paths — dailies need many solutions for variety
    const numPaths = countShortestPaths(startId, endId);
    if (numPaths < 5) continue; // require 5+ distinct shortest paths

    return {
      startPlayerId: startId,
      endPlayerId: endId,
      optimalPathLength: result.length,
      numValidPaths: numPaths,
      difficulty,
    };
  }

  console.warn(`[PuzzleGen] Failed to generate ${difficulty} puzzle after ${maxAttempts} attempts`);
  return null;
}

/**
 * Get today's difficulty based on the rotation cycle.
 */
export function getTodayDifficulty(puzzleNumber: number): keyof typeof config.difficulty {
  const rotation = config.difficultyRotation;
  return rotation[puzzleNumber % rotation.length];
}

/**
 * Get the next puzzle number.
 */
export function getNextPuzzleNumber(): number {
  const db = getDb();
  const row = db.prepare('SELECT MAX(puzzle_number) as max_num FROM daily_puzzles').get() as any;
  return (row?.max_num ?? 0) + 1;
}
