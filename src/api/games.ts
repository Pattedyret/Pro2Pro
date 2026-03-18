import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../data/db';
import { playerGraph } from '../game/graph';
import { findShortestPath, countShortestPaths, findAllShortestPaths } from '../game/pathfinder';
import { validateLink } from '../game/validator';
import { getPuzzleByNumber, getTodayPuzzle, getPuzzleById } from '../data/models/puzzle';
import { getUserAttempt, saveUserAttempt, getUserStats } from '../data/models/userStats';
import { authRequired, authOptional } from './middleware';
import { createWebSession, getWebSession, updateWebSession, deleteWebSession } from './webGameState';
import { awardCompletionPoints } from './points';
import { config } from '../config';
import { getFullPath } from '../bot/interactions/gameState';
import { calculatePar, getGameRating, formatScoreToPar } from '../game/scorer';

const router = Router();

// POST /games/start — start a game session
router.post('/start', authOptional, async (req, res) => {
  const { mode, puzzleNumber, difficulty, startPlayerId, endPlayerId } = req.body;
  const userId = req.user?.userId ?? `anon-${req.headers['x-session-id'] ?? 'unknown'}`;

  if (mode === 'daily') {
    const puzzle = puzzleNumber ? getPuzzleByNumber(puzzleNumber) : getTodayPuzzle();
    if (!puzzle) {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }

    // Check if already completed (only for authenticated users)
    if (req.user) {
      const existing = getUserAttempt(puzzle.id, userId);
      if (existing) {
        res.status(409).json({ error: 'Already completed this puzzle', attempt: existing });
        return;
      }
    }

    const sessionId = crypto.randomUUID();
    createWebSession(sessionId, userId, {
      puzzleId: puzzle.id,
      type: 'daily',
      forwardPath: [puzzle.start_player_id],
      backwardPath: [puzzle.end_player_id],
      searchDirection: 'forward',
      startPlayerId: puzzle.start_player_id,
      endPlayerId: puzzle.end_player_id,
    });

    const startPlayer = playerGraph.getPlayer(puzzle.start_player_id);
    const endPlayer = playerGraph.getPlayer(puzzle.end_player_id);

    res.json({
      sessionId,
      puzzleId: puzzle.id,
      startPlayer: { id: puzzle.start_player_id, name: startPlayer?.name ?? '???', nationality: startPlayer?.nationality, imageUrl: startPlayer?.imageUrl, teams: playerGraph.getPlayerFullTeamNames(puzzle.start_player_id, 2) },
      endPlayer: { id: puzzle.end_player_id, name: endPlayer?.name ?? '???', nationality: endPlayer?.nationality, imageUrl: endPlayer?.imageUrl, teams: playerGraph.getPlayerFullTeamNames(puzzle.end_player_id, 2) },
    });

  } else if (mode === 'random') {
    const tier = config.randomDifficulty[(difficulty ?? 'medium') as keyof typeof config.randomDifficulty];
    if (!tier) {
      res.status(400).json({ error: 'Invalid difficulty' });
      return;
    }

    // All difficulties use famous players as start/end — paths just get longer and more complex
    let pool = playerGraph.getFamousPlayerIds();
    if (pool.length < 20) pool = playerGraph.getNotablePlayerIds();

    // More attempts for harder difficulties since long paths between famous players are rarer
    const maxAttempts = difficulty === 'hard' ? 1500 : difficulty === 'medium' ? 400 : 200;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const startId = pool[Math.floor(Math.random() * pool.length)];
      const endId = pool[Math.floor(Math.random() * pool.length)];
      if (startId === endId) continue;

      const result = findShortestPath(startId, endId);
      if (!result || result.length < tier.minPath || result.length > tier.maxPath) continue;

      // For hard mode, prefer paths through obscure connections (weak links, lesser-known intermediates)
      if (difficulty === 'hard') {
        const obscurity = playerGraph.getPathObscurityScore(result.path);
        if (obscurity < 0.3) continue; // reject paths that are too "obvious"
      }

      const numPaths = countShortestPaths(startId, endId);
      if (numPaths < tier.minPaths) continue;

      const db = getDb();
      const insertResult = db.prepare(`
        INSERT INTO custom_games (discord_user_id, guild_id, channel_id, start_player_id, end_player_id, optimal_path_length, num_valid_paths, is_feasible)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(userId, '', 'web', startId, endId, result.length, numPaths);

      const gameId = Number(insertResult.lastInsertRowid);
      const sessionId = crypto.randomUUID();

      createWebSession(sessionId, userId, {
        puzzleId: gameId,
        type: 'custom',
        forwardPath: [startId],
        backwardPath: [endId],
        searchDirection: 'forward',
        startPlayerId: startId,
        endPlayerId: endId,
      });

      const startPlayer = playerGraph.getPlayer(startId);
      const endPlayer = playerGraph.getPlayer(endId);

      res.json({
        sessionId,
        gameId,
        difficulty: difficulty ?? 'medium',
        optimalPathLength: result.length,
        par: calculatePar(result.length),
        numValidPaths: numPaths,
        startPlayer: { id: startId, name: startPlayer?.name ?? '???', nationality: startPlayer?.nationality, imageUrl: startPlayer?.imageUrl, teams: playerGraph.getPlayerFullTeamNames(startId, 2) },
        endPlayer: { id: endId, name: endPlayer?.name ?? '???', nationality: endPlayer?.nationality, imageUrl: endPlayer?.imageUrl, teams: playerGraph.getPlayerFullTeamNames(endId, 2) },
      });
      return;
    }

    res.status(500).json({ error: 'Could not find a valid random pair. Try again.' });

  } else if (mode === 'custom') {
    if (!startPlayerId || !endPlayerId) {
      res.status(400).json({ error: 'Missing startPlayerId or endPlayerId' });
      return;
    }

    const p1 = playerGraph.getPlayer(startPlayerId);
    const p2 = playerGraph.getPlayer(endPlayerId);
    if (!p1 || !p2) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    const result = findShortestPath(startPlayerId, endPlayerId);
    if (!result) {
      res.status(400).json({ error: 'No connection between these players' });
      return;
    }

    const numPaths = countShortestPaths(startPlayerId, endPlayerId);
    const db = getDb();
    const insertResult = db.prepare(`
      INSERT INTO custom_games (discord_user_id, guild_id, channel_id, start_player_id, end_player_id, optimal_path_length, num_valid_paths, is_feasible)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(userId, '', 'web', startPlayerId, endPlayerId, result.length, numPaths);

    const gameId = Number(insertResult.lastInsertRowid);
    const sessionId = crypto.randomUUID();

    createWebSession(sessionId, userId, {
      puzzleId: gameId,
      type: 'custom',
      forwardPath: [startPlayerId],
      backwardPath: [endPlayerId],
      searchDirection: 'forward',
      startPlayerId: startPlayerId,
      endPlayerId: endPlayerId,
    });

    res.json({
      sessionId,
      gameId,
      optimalPathLength: result.length,
      numValidPaths: numPaths,
      startPlayer: { id: startPlayerId, name: p1.name ?? '???', nationality: p1.nationality, imageUrl: p1.imageUrl, teams: playerGraph.getPlayerFullTeamNames(startPlayerId, 2) },
      endPlayer: { id: endPlayerId, name: p2.name ?? '???', nationality: p2.nationality, imageUrl: p2.imageUrl, teams: playerGraph.getPlayerFullTeamNames(endPlayerId, 2) },
    });
  } else {
    res.status(400).json({ error: 'Invalid mode. Use: daily, random, custom' });
  }
});

// POST /games/:sessionId/guess — submit a guess
router.post('/:sessionId/guess', authOptional, (req, res) => {
  const sessionId = req.params.sessionId as string;
  const { playerId, direction } = req.body;
  const userId = req.user?.userId ?? `anon-${req.headers['x-session-id'] ?? 'unknown'}`;

  const game = getWebSession(sessionId, userId);
  if (!game) {
    res.status(404).json({ error: 'Game session not found or expired' });
    return;
  }

  const dir = direction === 'backward' ? 'backward' : 'forward';
  const chain = dir === 'forward' ? game.forwardPath : game.backwardPath;
  const lastPlayerId = chain[chain.length - 1];

  const validation = validateLink(lastPlayerId, playerId);
  if (!validation.valid) {
    const fromName = playerGraph.getPlayer(lastPlayerId)?.name ?? '???';
    const toName = playerGraph.getPlayer(playerId)?.name ?? '???';
    res.json({ valid: false, error: `${fromName} and ${toName} never shared a team` });
    return;
  }

  // Check duplicates
  if (game.forwardPath.includes(playerId) || game.backwardPath.includes(playerId)) {
    res.json({ valid: false, error: `${playerGraph.getPlayer(playerId)?.name} is already in your path` });
    return;
  }

  // Add to chain
  if (dir === 'forward') game.forwardPath.push(playerId);
  else game.backwardPath.push(playerId);

  const teamInfo = validation.sharedTeams.map(t => ({
    name: t.teamAcronym ?? t.teamName,
    imageUrl: t.teamImageUrl,
  }));

  // Check completion
  let isComplete = false;
  if (dir === 'forward' && playerId === game.endPlayerId) isComplete = true;
  else if (dir === 'backward' && playerId === game.startPlayerId) isComplete = true;

  if (!isComplete) {
    const fwdTip = game.forwardPath[game.forwardPath.length - 1];
    const bwdTip = game.backwardPath[game.backwardPath.length - 1];
    if (playerGraph.areConnected(fwdTip, bwdTip)) isComplete = true;
  }

  if (isComplete) {
    const fullPath = getFullPath(game);
    const pathLength = fullPath.length - 1;
    let optimalLength: number;
    let difficulty: string | undefined;

    if (game.type === 'daily') {
      const puzzle = getPuzzleById(game.puzzleId);
      optimalLength = puzzle?.optimal_path_length ?? pathLength;
      difficulty = puzzle?.difficulty;

      if (req.user) {
        saveUserAttempt({
          puzzleId: game.puzzleId,
          userId,
          guildId: null,
          path: fullPath,
          pathLength,
          isValid: true,
          isOptimal: pathLength === optimalLength,
        });
      }
    } else {
      const shortest = findShortestPath(game.startPlayerId, game.endPlayerId);
      optimalLength = shortest?.length ? shortest.length - 1 : pathLength;
    }

    const isOptimal = pathLength === optimalLength;
    let points: any = null;
    if (req.user) {
      const stats = getUserStats(userId);
      points = awardCompletionPoints({
        userId,
        source: 'web',
        puzzleId: game.type === 'daily' ? game.puzzleId : undefined,
        customGameId: game.type === 'custom' ? game.puzzleId : undefined,
        isOptimal,
        difficulty,
        currentStreak: stats.current_streak,
      });
    }

    deleteWebSession(sessionId);

    const pathNames = fullPath.map(id => ({
      id,
      name: playerGraph.getPlayer(id)?.name ?? '???',
      nationality: playerGraph.getPlayer(id)?.nationality,
    }));

    const par = calculatePar(optimalLength);
    const scoreToPar = pathLength - par;
    const rating = getGameRating(scoreToPar);

    res.json({
      valid: true,
      complete: true,
      teams: teamInfo,
      path: pathNames,
      pathLength,
      optimalLength,
      par,
      scoreToPar,
      scoreToParStr: formatScoreToPar(scoreToPar),
      rating,
      isOptimal,
      points,
    });
    return;
  }

  // Persist updated game state to DB (SQLite-backed sessions return a copy, not a reference)
  updateWebSession(sessionId, game);

  const player = playerGraph.getPlayer(playerId);
  res.json({
    valid: true,
    complete: false,
    teams: teamInfo,
    player: { id: playerId, name: player?.name ?? '???', nationality: player?.nationality },
    forwardPath: game.forwardPath.map(id => ({ id, name: playerGraph.getPlayer(id)?.name ?? '???' })),
    backwardPath: game.backwardPath.map(id => ({ id, name: playerGraph.getPlayer(id)?.name ?? '???' })),
  });
});

// POST /games/:sessionId/giveup
router.post('/:sessionId/giveup', authOptional, (req, res) => {
  const sessionId = req.params.sessionId as string;
  const userId = req.user?.userId ?? `anon-${req.headers['x-session-id'] ?? 'unknown'}`;

  const game = getWebSession(sessionId, userId);
  if (!game) {
    res.status(404).json({ error: 'Game session not found or expired' });
    return;
  }

  const allPaths = findAllShortestPaths(game.startPlayerId, game.endPlayerId, 3);
  deleteWebSession(sessionId);

  // Mark daily as attempted (given up) so they can't replay (auth'd users only)
  if (game.type === 'daily' && req.user) {
    const db = getDb();
    try {
      db.prepare(`
        INSERT OR IGNORE INTO user_attempts (puzzle_id, discord_user_id, path, path_length, is_valid, is_optimal, source)
        VALUES (?, ?, '[]', 0, 0, 0, 'web')
      `).run(game.puzzleId, userId);
    } catch {}
  }

  const solutions = allPaths.map(path =>
    path.map(id => ({
      id,
      name: playerGraph.getPlayer(id)?.name ?? '???',
      nationality: playerGraph.getPlayer(id)?.nationality,
    }))
  );

  res.json({
    solutions,
    optimalLength: allPaths.length > 0 ? allPaths[0].length - 1 : null,
  });
});

export default router;
