import { getDb } from '../db';
import { getRegion } from '../../game/regions';

export interface UserStats {
  discord_user_id: string;
  games_played: number;
  games_won: number;
  current_streak: number;
  max_streak: number;
  avg_path_length: number;
}

export interface UserAllStats {
  discord_user_id: string;
  daily_played: number;
  daily_won: number;
  custom_played: number;
  custom_won: number;
  random_played: number;
  random_won: number;
  current_streak: number;
  max_streak: number;
  avg_path_length: number;
}

export interface PlayerPick {
  player_id: number;
  pick_count: number;
}

export interface RegionStat {
  region: string;
  pick_count: number;
}

export interface UserAttempt {
  id: number;
  puzzle_id: number;
  discord_user_id: string;
  guild_id: string | null;
  path: string; // JSON
  path_length: number;
  is_valid: boolean;
  is_optimal: boolean;
  completed_at: string;
}

export function getUserStats(userId: string): UserStats {
  const db = getDb();
  let stats = db.prepare('SELECT * FROM user_stats WHERE discord_user_id = ?').get(userId) as UserStats | undefined;

  if (!stats) {
    db.prepare(`
      INSERT INTO user_stats (discord_user_id) VALUES (?)
    `).run(userId);
    stats = {
      discord_user_id: userId,
      games_played: 0,
      games_won: 0,
      current_streak: 0,
      max_streak: 0,
      avg_path_length: 0,
    };
  }

  return stats;
}

export function getUserAttempt(puzzleId: number, userId: string): UserAttempt | null {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM user_attempts WHERE puzzle_id = ? AND discord_user_id = ?'
  ).get(puzzleId, userId) as UserAttempt | null;
}

export function saveUserAttempt(attempt: {
  puzzleId: number;
  userId: string;
  guildId: string | null;
  path: number[];
  pathLength: number;
  isValid: boolean;
  isOptimal: boolean;
}): void {
  const db = getDb();

  db.prepare(`
    INSERT OR REPLACE INTO user_attempts (puzzle_id, discord_user_id, guild_id, path, path_length, is_valid, is_optimal)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    attempt.puzzleId,
    attempt.userId,
    attempt.guildId,
    JSON.stringify(attempt.path),
    attempt.pathLength,
    attempt.isValid ? 1 : 0,
    attempt.isOptimal ? 1 : 0
  );

  // Update user stats (daily-only table)
  const stats = getUserStats(attempt.userId);
  const newGamesPlayed = stats.games_played + 1;
  const newGamesWon = stats.games_won + (attempt.isOptimal ? 1 : 0);
  const newStreak = attempt.isValid ? stats.current_streak + 1 : 0;
  const newMaxStreak = Math.max(stats.max_streak, newStreak);
  const newAvg = stats.avg_path_length === 0
    ? attempt.pathLength
    : (stats.avg_path_length * stats.games_played + attempt.pathLength) / newGamesPlayed;

  db.prepare(`
    UPDATE user_stats SET
      games_played = ?,
      games_won = ?,
      current_streak = ?,
      max_streak = ?,
      avg_path_length = ?
    WHERE discord_user_id = ?
  `).run(newGamesPlayed, newGamesWon, newStreak, newMaxStreak, newAvg, attempt.userId);

  // Update all-time stats (daily columns)
  updateAllStats(attempt.userId, 'daily', attempt.pathLength, attempt.isOptimal);

  // Track player picks (intermediate players only)
  savePlayerPicks(attempt.userId, attempt.path);
}

export function getUserAllStats(userId: string): UserAllStats {
  const db = getDb();
  let stats = db.prepare('SELECT * FROM user_all_stats WHERE discord_user_id = ?').get(userId) as UserAllStats | undefined;

  if (!stats) {
    db.prepare(`INSERT INTO user_all_stats (discord_user_id) VALUES (?)`).run(userId);
    stats = {
      discord_user_id: userId,
      daily_played: 0,
      daily_won: 0,
      custom_played: 0,
      custom_won: 0,
      random_played: 0,
      random_won: 0,
      current_streak: 0,
      max_streak: 0,
      avg_path_length: 0,
    };
  }

  return stats;
}

const ALLOWED_GAME_MODES = new Set(['daily', 'custom', 'random']);

function updateAllStats(userId: string, gameMode: 'daily' | 'custom' | 'random', pathLength: number, isOptimal: boolean): void {
  if (!ALLOWED_GAME_MODES.has(gameMode)) {
    throw new Error(`updateAllStats: invalid gameMode "${gameMode}"`);
  }

  const db = getDb();
  const allStats = getUserAllStats(userId);

  const playedCol = `${gameMode}_played`;
  const wonCol = `${gameMode}_won`;
  const totalPlayed = (allStats.daily_played + allStats.custom_played + allStats.random_played);
  const newTotalPlayed = totalPlayed + 1;

  const newAvg = allStats.avg_path_length === 0
    ? pathLength
    : (allStats.avg_path_length * totalPlayed + pathLength) / newTotalPlayed;

  // For streaks: only daily games affect streaks in user_all_stats
  // Streak increments on any valid completion (consistent with user_stats behavior)
  let newStreak = allStats.current_streak;
  let newMaxStreak = allStats.max_streak;
  if (gameMode === 'daily') {
    newStreak = allStats.current_streak + 1;
    newMaxStreak = Math.max(allStats.max_streak, newStreak);
  }

  db.prepare(`
    UPDATE user_all_stats SET
      ${playedCol} = ${playedCol} + 1,
      ${wonCol} = ${wonCol} + ?,
      current_streak = ?,
      max_streak = ?,
      avg_path_length = ?
    WHERE discord_user_id = ?
  `).run(isOptimal ? 1 : 0, newStreak, newMaxStreak, newAvg, userId);
}

export function savePlayerPicks(userId: string, path: number[]): void {
  if (path.length <= 2) return; // No intermediate players
  const db = getDb();
  const intermediates = path.slice(1, -1);

  const stmt = db.prepare(`
    INSERT INTO user_player_picks (discord_user_id, player_id, pick_count)
    VALUES (?, ?, 1)
    ON CONFLICT(discord_user_id, player_id) DO UPDATE SET pick_count = pick_count + 1
  `);

  for (const playerId of intermediates) {
    stmt.run(userId, playerId);
  }
}

export function saveCustomGameAttempt(attempt: {
  customGameId: number;
  userId: string;
  path: number[];
  pathLength: number;
  isValid: boolean;
  isOptimal: boolean;
  gameMode: 'custom' | 'random';
}): void {
  const db = getDb();

  db.prepare(`
    INSERT INTO custom_game_attempts (custom_game_id, discord_user_id, path, path_length, is_valid, is_optimal)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    attempt.customGameId,
    attempt.userId,
    JSON.stringify(attempt.path),
    attempt.pathLength,
    attempt.isValid ? 1 : 0,
    attempt.isOptimal ? 1 : 0
  );

  // Update all-time stats
  updateAllStats(attempt.userId, attempt.gameMode, attempt.pathLength, attempt.isOptimal);

  // Track player picks
  savePlayerPicks(attempt.userId, attempt.path);
}

export function getTopPlayerPicks(userId: string, limit = 5): PlayerPick[] {
  const db = getDb();
  return db.prepare(`
    SELECT player_id, pick_count FROM user_player_picks
    WHERE discord_user_id = ?
    ORDER BY pick_count DESC
    LIMIT ?
  `).all(userId, limit) as PlayerPick[];
}

export function getUserRegionStats(userId: string): RegionStat[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT p.nationality, upp.pick_count
    FROM user_player_picks upp
    JOIN players p ON p.id = upp.player_id
    WHERE upp.discord_user_id = ?
  `).all(userId) as { nationality: string | null; pick_count: number }[];

  const regionCounts = new Map<string, number>();
  for (const row of rows) {
    const region = getRegion(row.nationality);
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + row.pick_count);
  }

  return Array.from(regionCounts.entries())
    .map(([region, pick_count]) => ({ region, pick_count }))
    .sort((a, b) => b.pick_count - a.pick_count);
}

export function getLeaderboard(guildId: string, limit = 10): (UserStats & { rank: number })[] {
  const db = getDb();

  // Get users who have played in this guild
  const users = db.prepare(`
    SELECT DISTINCT ua.discord_user_id
    FROM user_attempts ua
    WHERE ua.guild_id = ?
  `).all(guildId) as { discord_user_id: string }[];

  const userIds = users.map(u => u.discord_user_id);
  if (userIds.length === 0) return [];

  const placeholders = userIds.map(() => '?').join(',');
  const stats = db.prepare(`
    SELECT * FROM user_stats
    WHERE discord_user_id IN (${placeholders})
    ORDER BY games_won DESC, avg_path_length ASC
    LIMIT ?
  `).all(...userIds, limit) as UserStats[];

  return stats.map((s, i) => ({ ...s, rank: i + 1 }));
}
