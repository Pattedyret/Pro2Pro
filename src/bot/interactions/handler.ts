import {
  Interaction,
  ButtonInteraction,
  ModalSubmitInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { handlePro2Pro } from '../commands/pro2pro';
import { handleAdmin } from '../commands/admin';
import { handleCustom, handleAutocomplete } from '../commands/custom';
import { handleRandom } from '../commands/random';
import { handleStats } from '../commands/stats';
import { handleActiveGames } from '../commands/activegames';
import { activeGames, getGameKey, getFullPath, givenUpGames, originalMessages } from './gameState';
import { playerGraph } from '../../game/graph';
import { validateLink } from '../../game/validator';
import { scorePath, calculatePar, getGameRating, formatScoreToPar } from '../../game/scorer';
import { findShortestPath, findAllShortestPaths, findMultiTeamPath } from '../../game/pathfinder';
import { getTodayPuzzle, getPuzzleById } from '../../data/models/puzzle';
import { saveUserAttempt, getUserAttempt, saveCustomGameAttempt, recordGiveUp, getUserStats } from '../../data/models/userStats';
import { awardCompletionPoints } from '../../api/points';
import { config } from '../../config';
import {
  createSearchModal,
  createPlayerButtons,
  createPuzzleEmbed,
  createProgressEmbed,
  createResultEmbed,
} from './gameEmbed';

/**
 * Find an active game for a user, checking both daily and custom keys.
 */
function findActiveGame(userId: string, puzzleId: number): import('./gameState').GameState | undefined {
  // Try daily first (exact puzzleId match only)
  const dailyKey = getGameKey('daily', userId);
  const daily = activeGames.get(dailyKey);
  if (daily && daily.puzzleId === puzzleId) return daily;

  // Try custom
  const customKey = getGameKey('custom', userId, puzzleId);
  const custom = activeGames.get(customKey);
  if (custom) return custom;

  return undefined;
}

/** Build progress embed options from game state (avoids duplicating this in multiple handlers). */
function buildProgressOpts(game: import('./gameState').GameState): Parameters<typeof createProgressEmbed>[0] {
  const opts: Parameters<typeof createProgressEmbed>[0] = {
    puzzleId: game.puzzleId,
    gameType: game.type,
    forwardPath: game.forwardPath,
    backwardPath: game.backwardPath,
    startPlayerId: game.startPlayerId,
    endPlayerId: game.endPlayerId,
  };

  if (game.type === 'daily') {
    const puzzle = getTodayPuzzle();
    if (puzzle) {
      const tier = config.difficulty[puzzle.difficulty as keyof typeof config.difficulty];
      opts.puzzleNumber = puzzle.puzzle_number;
      opts.difficulty = puzzle.difficulty;
      opts.difficultyStars = tier?.stars ?? 2;
      opts.optimalLength = puzzle.optimal_path_length;
    }
  } else {
    const { getDb } = require('../../data/db');
    const db = getDb();
    const customGame = db.prepare('SELECT optimal_path_length FROM custom_games WHERE id = ?').get(game.puzzleId) as any;
    if (customGame) {
      opts.optimalLength = customGame.optimal_path_length;
    }
  }

  return opts;
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'pro2pro':
          await handlePro2Pro(interaction);
          break;
        case 'custom':
          await handleCustom(interaction);
          break;
        case 'random':
          await handleRandom(interaction);
          break;
        case 'stats':
          await handleStats(interaction);
          break;
        case 'activegames':
          await handleActiveGames(interaction);
          break;
        case 'admin':
          await handleAdmin(interaction);
          break;
      }
    } else if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    }
  } catch (error) {
    console.error('[Handler] Error:', error);
    const reply = interaction.isRepliable()
      ? interaction.deferred
        ? interaction.editReply({ content: 'Something went wrong!' })
        : interaction.reply({ content: 'Something went wrong!', flags: 64 })
      : Promise.resolve();
    await reply.catch(() => {});
  }
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const [action, ...args] = interaction.customId.split(':');

  switch (action) {
    case 'game_search': {
      // Legacy fallback — treat as forward direction
      let gameType: 'daily' | 'custom' = 'daily';
      let puzzleId: number;
      if (args[0] === 'custom') {
        gameType = 'custom';
        puzzleId = parseInt(args[1]);
      } else {
        puzzleId = parseInt(args[0]);
      }
      const modal = createSearchModal(puzzleId, gameType, 'forward');
      await interaction.showModal(modal);
      break;
    }

    case 'game_search_fwd': {
      let gameType: 'daily' | 'custom' = 'daily';
      let puzzleId: number;
      if (args[0] === 'custom') {
        gameType = 'custom';
        puzzleId = parseInt(args[1]);
      } else {
        puzzleId = parseInt(args[0]);
      }

      // Update game direction if game exists
      const fwdGameKey = getGameKey(gameType, interaction.user.id, gameType === 'custom' ? puzzleId : undefined);
      const fwdGame = activeGames.get(fwdGameKey);
      if (fwdGame) fwdGame.searchDirection = 'forward';

      const fwdModal = createSearchModal(puzzleId, gameType, 'forward');
      await interaction.showModal(fwdModal);
      break;
    }

    case 'game_search_bwd': {
      let gameType: 'daily' | 'custom' = 'daily';
      let puzzleId: number;
      if (args[0] === 'custom') {
        gameType = 'custom';
        puzzleId = parseInt(args[1]);
      } else {
        puzzleId = parseInt(args[0]);
      }

      // Update game direction if game exists
      const bwdGameKey = getGameKey(gameType, interaction.user.id, gameType === 'custom' ? puzzleId : undefined);
      const bwdGame = activeGames.get(bwdGameKey);
      if (bwdGame) bwdGame.searchDirection = 'backward';

      const bwdModal = createSearchModal(puzzleId, gameType, 'backward');
      await interaction.showModal(bwdModal);
      break;
    }

    case 'game_finish': {
      await handleFinish(interaction, parseInt(args[0]));
      break;
    }

    case 'game_undo': {
      // Legacy fallback — auto-pick direction
      await handleUndo(interaction, parseInt(args[0]));
      break;
    }

    case 'game_undo_fwd': {
      await handleUndo(interaction, parseInt(args[0]), 'forward');
      break;
    }

    case 'game_undo_bwd': {
      await handleUndo(interaction, parseInt(args[0]), 'backward');
      break;
    }

    case 'game_giveup': {
      await handleGiveUp(interaction, parseInt(args[0]));
      break;
    }

    case 'select_player': {
      const gameType = args[0] as 'daily' | 'custom';
      const puzzleId = parseInt(args[1]);
      const playerId = parseInt(args[2]);
      const direction = (args[3] as 'forward' | 'backward') ?? 'forward';
      await handlePlayerSelect(interaction, gameType, puzzleId, playerId, direction);
      break;
    }

    case 'game_share': {
      const { getShareText } = require('./gameState');
      const shareText = getShareText(interaction.user.id);
      if (shareText) {
        await interaction.reply({ content: shareText });
      } else {
        await interaction.reply({ content: 'No result to share.', flags: 64 });
      }
      break;
    }
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const gameType = parts[1];
  const puzzleIdStr = parts[2];
  const direction = (parts[3] as 'forward' | 'backward') ?? 'forward';
  const query = interaction.fields.getTextInputValue('player_search_input');
  const puzzleId = parseInt(puzzleIdStr);

  const results = playerGraph.searchPlayers(query, 10);

  if (results.length === 0) {
    // Try fuzzy matching for "did you mean?" suggestions
    const fuzzy = playerGraph.fuzzySearchPlayers(query, 5);
    if (fuzzy.length > 0) {
      const rows = createPlayerButtons(
        fuzzy.map(p => ({ id: p.id, label: playerGraph.getPlayerButtonLabel(p.id) })),
        puzzleId,
        gameType as 'daily' | 'custom',
        direction
      );
      await interaction.reply({
        content: `No exact match for "${query}". Did you mean:`,
        components: rows,
        flags: 64,
      });
    } else {
      await interaction.reply({
        content: `No players found matching "${query}". Try a different name.`,
        flags: 64,
      });
    }
    return;
  }

  const rows = createPlayerButtons(
    results.map(p => ({ id: p.id, label: playerGraph.getPlayerButtonLabel(p.id) })),
    puzzleId,
    gameType as 'daily' | 'custom',
    direction
  );

  await interaction.reply({
    content: `Select a player:`,
    components: rows,
    flags: 64,
  });
}

async function handlePlayerSelect(
  interaction: ButtonInteraction,
  gameType: 'daily' | 'custom',
  puzzleId: number,
  playerId: number,
  direction: 'forward' | 'backward'
): Promise<void> {
  // Block guessing after giving up
  if (givenUpGames.has(`${interaction.user.id}:${gameType}:${puzzleId}`)) {
    await interaction.reply({ content: 'You already gave up on this game!', flags: 64 });
    return;
  }

  const gameKey = getGameKey(gameType, interaction.user.id, gameType === 'custom' ? puzzleId : undefined);
  let game = activeGames.get(gameKey);

  // If no active game, initialize one
  if (!game) {
    if (gameType === 'daily') {
      const puzzle = getTodayPuzzle();
      if (!puzzle) {
        await interaction.reply({ content: 'No active puzzle!', flags: 64 });
        return;
      }

      // Check if already completed
      const existing = getUserAttempt(puzzle.id, interaction.user.id);
      if (existing) {
        await interaction.reply({ content: "You've already completed today's puzzle!", flags: 64 });
        return;
      }

      game = {
        puzzleId: puzzle.id,
        type: 'daily',
        forwardPath: [puzzle.start_player_id],
        backwardPath: [puzzle.end_player_id],
        searchDirection: direction,
        startPlayerId: puzzle.start_player_id,
        endPlayerId: puzzle.end_player_id,
      };
      activeGames.set(gameKey, game);
    } else {
      // Custom game - look up from DB
      const { getDb } = require('../../data/db');
      const db = getDb();
      const customGame = db.prepare('SELECT * FROM custom_games WHERE id = ?').get(puzzleId) as any;
      if (!customGame) {
        await interaction.reply({ content: 'Custom game not found!', flags: 64 });
        return;
      }

      game = {
        puzzleId,
        type: 'custom',
        forwardPath: [customGame.start_player_id],
        backwardPath: [customGame.end_player_id],
        searchDirection: direction,
        startPlayerId: customGame.start_player_id,
        endPlayerId: customGame.end_player_id,
        difficulty: customGame.difficulty ?? undefined,
      };
      activeGames.set(gameKey, game);
    }
  }

  // Determine which chain to validate against based on direction
  const activeChain = direction === 'forward' ? game.forwardPath : game.backwardPath;
  const lastPlayerId = activeChain[activeChain.length - 1];
  const validation = validateLink(lastPlayerId, playerId);

  if (!validation.valid) {
    // Show error with full progress embed + game buttons so user can retry
    const errOpts = buildProgressOpts(game);
    const { embed: errEmbed, rows: errRows } = createProgressEmbed(errOpts);
    await interaction.update({
      content: `\u274C **${playerGraph.getPlayerNameWithFlag(lastPlayerId)}** and **${playerGraph.getPlayerNameWithFlag(playerId)}** never shared a team! Try someone else.`,
      embeds: [errEmbed],
      components: errRows,
    });
    return;
  }

  // Check for duplicates across BOTH chains
  if (game.forwardPath.includes(playerId) || game.backwardPath.includes(playerId)) {
    const dupOpts = buildProgressOpts(game);
    const { embed: dupEmbed, rows: dupRows } = createProgressEmbed(dupOpts);
    await interaction.update({
      content: `\u274C **${playerGraph.getPlayerNameWithFlag(playerId)}** is already in your path! Choose a different player.`,
      embeds: [dupEmbed],
      components: dupRows,
    });
    return;
  }

  // Insane mode: enforce multi-team rule — no team reused in consecutive links
  if (game.difficulty === 'insane') {
    const activeChain = direction === 'forward' ? game.forwardPath : game.backwardPath;
    if (playerGraph.wouldRepeatTeam(activeChain, playerId)) {
      const progressOpts = buildProgressOpts(game);
      const { embed, rows } = createProgressEmbed(progressOpts);
      await interaction.update({
        content: `\u274C **Insane mode:** You can't connect through the same team twice in a row! **${playerGraph.getPlayerNameWithFlag(playerId)}** shares a team with the previous link. Find a different route.`,
        embeds: [embed],
        components: rows,
      });
      return;
    }
  }

  // Add to the appropriate chain
  if (direction === 'forward') {
    game.forwardPath.push(playerId);
  } else {
    game.backwardPath.push(playerId);
  }

  // Persist updated state to DB (SQLite returns copies, not references)
  activeGames.set(gameKey, game);

  const teamNames = validation.sharedTeams.map(t => t.teamAcronym ?? t.teamName).join(', ');
  const selectedName = playerGraph.getPlayerNameWithFlag(playerId);

  // Check completion conditions
  let isComplete = false;

  // Direct completion: forward reached end, or backward reached start
  if (direction === 'forward' && playerId === game.endPlayerId) {
    isComplete = true;
  } else if (direction === 'backward' && playerId === game.startPlayerId) {
    isComplete = true;
  }

  // Bridge completion: the tips of forward and backward chains are connected
  if (!isComplete) {
    const fwdTip = game.forwardPath[game.forwardPath.length - 1];
    const bwdTip = game.backwardPath[game.backwardPath.length - 1];
    if (playerGraph.areConnected(fwdTip, bwdTip)) {
      isComplete = true;
    }
  }

  if (isComplete) {
    await completeGame(interaction, game);
    return;
  }

  // Show updated progress (unified for daily and custom)
  const progressOpts = buildProgressOpts(game);
  const { embed, rows } = createProgressEmbed(progressOpts);
  await interaction.update({
    content: `\u2705 Added **${selectedName}** (via **${teamNames}**)`,
    embeds: [embed],
    components: rows,
  });
}

async function completeGame(interaction: ButtonInteraction, game: import('./gameState').GameState): Promise<void> {
  const fullPath = getFullPath(game);
  const pathLength = fullPath.length - 1;

  let optimalLength: number;
  let puzzleNumber = 0;
  let difficulty = 'medium';
  let difficultyStars = 2;

  if (game.type === 'daily') {
    const puzzle = getPuzzleById(game.puzzleId);
    if (!puzzle) return;
    optimalLength = puzzle.optimal_path_length;
    puzzleNumber = puzzle.puzzle_number;
    difficulty = puzzle.difficulty;
    const tier = config.difficulty[difficulty as keyof typeof config.difficulty];
    difficultyStars = tier?.stars ?? 2;

    // Save attempt
    saveUserAttempt({
      puzzleId: game.puzzleId,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      path: fullPath,
      pathLength,
      isValid: true,
      isOptimal: pathLength === optimalLength,
    });
  } else {
    const shortest = findShortestPath(game.startPlayerId, game.endPlayerId);
    optimalLength = shortest?.length ?? pathLength;

    // Look up game_mode from custom_games table
    const { getDb } = require('../../data/db');
    const cgDb = getDb();
    const customGameRow = cgDb.prepare('SELECT game_mode FROM custom_games WHERE id = ?').get(game.puzzleId) as { game_mode: string } | undefined;
    const gameMode = (customGameRow?.game_mode === 'random' ? 'random' : 'custom') as 'custom' | 'random';

    saveCustomGameAttempt({
      customGameId: game.puzzleId,
      userId: interaction.user.id,
      path: fullPath,
      pathLength,
      isValid: true,
      isOptimal: pathLength === optimalLength,
      gameMode,
    });
  }

  const isOptimal = pathLength === optimalLength;

  // Award points
  const userStats = getUserStats(interaction.user.id);
  awardCompletionPoints({
    userId: interaction.user.id,
    guildId: interaction.guildId ?? undefined,
    source: 'bot',
    puzzleId: game.type === 'daily' ? game.puzzleId : undefined,
    customGameId: game.type === 'custom' ? game.puzzleId : undefined,
    isOptimal,
    difficulty: game.type === 'daily' ? difficulty : undefined,
    currentStreak: userStats.current_streak,
  });

  const pathNames = fullPath.map(id => playerGraph.getPlayerNameWithFlag(id));

  // Find an optimal path to show
  const optimalPath = findShortestPath(game.startPlayerId, game.endPlayerId);
  const optimalPathNames = optimalPath
    ? optimalPath.path.map(id => playerGraph.getPlayerNameWithFlag(id))
    : null;

  const { shareText } = scorePath(fullPath, optimalLength, puzzleNumber, difficulty, difficultyStars, optimalPathNames, interaction.user.username);
  const embed = createResultEmbed(
    puzzleNumber,
    pathNames,
    pathLength,
    optimalLength,
    isOptimal,
    shareText,
    difficulty,
    difficultyStars,
    optimalPathNames
  );

  const shareRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`game_share:${game.puzzleId}`)
      .setLabel('\uD83D\uDCCB Share Result')
      .setStyle(ButtonStyle.Secondary),
  );

  // Store share text temporarily
  const { setShareText } = require('./gameState');
  setShareText(interaction.user.id, shareText);

  // Clean up game state
  const gameKey = getGameKey(game.type, interaction.user.id, game.type === 'custom' ? game.puzzleId : undefined);
  activeGames.delete(gameKey);

  await interaction.update({
    content: shareText,
    embeds: [embed],
    components: [shareRow],
  });

  // Announce completion publicly
  const par = calculatePar(optimalLength);
  const scoreToPar = pathLength - par;
  const rating = getGameRating(scoreToPar);
  const scoreStr = formatScoreToPar(scoreToPar);
  const startName = playerGraph.getPlayerNameWithFlag(game.startPlayerId);
  const endName = playerGraph.getPlayerNameWithFlag(game.endPlayerId);
  await interaction.followUp({
    content: `**${interaction.user.displayName}** scored **${rating}** (${scoreStr}) on **${startName}** to **${endName}** — ${pathLength} steps (Par ${par})`,
  });

  // Update the original random game message to show "Completed"
  await updateOriginalMessage(interaction, game, 'completed', pathLength, optimalLength);
}

async function handleFinish(interaction: ButtonInteraction, puzzleId: number): Promise<void> {
  const game = findActiveGame(interaction.user.id, puzzleId);

  if (!game) {
    await interaction.reply({ content: 'No active game found! Use `/pro2pro play` to start.', flags: 64 });
    return;
  }

  // Check if forward chain reached end, backward chain reached start, or chains are bridged
  const fwdTip = game.forwardPath[game.forwardPath.length - 1];
  const bwdTip = game.backwardPath[game.backwardPath.length - 1];

  const isComplete =
    fwdTip === game.endPlayerId ||
    bwdTip === game.startPlayerId ||
    playerGraph.areConnected(fwdTip, bwdTip);

  if (!isComplete) {
    const progressOpts = buildProgressOpts(game);
    const { embed, rows } = createProgressEmbed(progressOpts);
    await interaction.update({
      content: `\u274C Your path isn't complete yet! The forward and backward chains aren't connected.`,
      embeds: [embed],
      components: rows,
    });
    return;
  }

  await completeGame(interaction, game);
}

async function handleUndo(interaction: ButtonInteraction, puzzleId: number, direction?: 'forward' | 'backward'): Promise<void> {
  const game = findActiveGame(interaction.user.id, puzzleId);

  if (!game) {
    await interaction.reply({ content: 'Nothing to undo!', flags: 64 });
    return;
  }

  // Check if there's anything to undo
  if (game.forwardPath.length <= 1 && game.backwardPath.length <= 1) {
    const progressOpts = buildProgressOpts(game);
    const { embed, rows } = createProgressEmbed(progressOpts);
    await interaction.update({
      content: `\u274C Nothing to undo!`,
      embeds: [embed],
      components: rows,
    });
    return;
  }

  // Determine which chain to undo from
  let undoChain: 'forward' | 'backward';
  if (direction) {
    // User explicitly chose a direction
    undoChain = direction;
    // If that chain has nothing to undo, tell the user
    const chain = undoChain === 'forward' ? game.forwardPath : game.backwardPath;
    if (chain.length <= 1) {
      const label = undoChain === 'forward' ? 'start' : 'end';
      const progressOpts = buildProgressOpts(game);
      const { embed, rows } = createProgressEmbed(progressOpts);
      await interaction.update({
        content: `\u274C Nothing to undo from the ${label} side!`,
        embeds: [embed],
        components: rows,
      });
      return;
    }
  } else {
    // Legacy: auto-pick whichever is longer (forward if tied)
    if (game.forwardPath.length > game.backwardPath.length) {
      undoChain = 'forward';
    } else if (game.backwardPath.length > game.forwardPath.length) {
      undoChain = 'backward';
    } else {
      undoChain = 'forward';
    }
    // If chosen chain is at anchor length, try the other
    if (undoChain === 'forward' && game.forwardPath.length <= 1) {
      undoChain = 'backward';
    } else if (undoChain === 'backward' && game.backwardPath.length <= 1) {
      undoChain = 'forward';
    }
  }

  const chain = undoChain === 'forward' ? game.forwardPath : game.backwardPath;
  const removed = chain.pop()!;
  const removedName = playerGraph.getPlayerNameWithFlag(removed);

  // Persist updated state after undo
  const undoGameKey = getGameKey(game.type, interaction.user.id, game.type === 'custom' ? game.puzzleId : undefined);
  activeGames.set(undoGameKey, game);

  // Back to initial state for daily games — show the puzzle embed
  if (game.type === 'daily' && game.forwardPath.length === 1 && game.backwardPath.length === 1) {
    const puzzle = getTodayPuzzle();
    if (puzzle) {
      const { embed, rows } = createPuzzleEmbed(puzzle);
      await interaction.update({
        content: `\u21A9 Removed **${removedName}**`,
        embeds: [embed],
        components: rows,
      });
      return;
    }
  }

  // Show progress embed (unified for daily and custom)
  const progressOpts = buildProgressOpts(game);
  const { embed, rows } = createProgressEmbed(progressOpts);
  await interaction.update({
    content: `\u21A9 Removed **${removedName}**`,
    embeds: [embed],
    components: rows,
  });
}

async function handleGiveUp(interaction: ButtonInteraction, puzzleId: number): Promise<void> {
  let game = findActiveGame(interaction.user.id, puzzleId);

  // If no active game in memory, look up start/end from DB
  if (!game) {
    // Try daily puzzle
    const puzzle = getTodayPuzzle();
    if (puzzle && puzzle.id === puzzleId) {
      game = { puzzleId, type: 'daily', forwardPath: [], backwardPath: [], searchDirection: 'forward', startPlayerId: puzzle.start_player_id, endPlayerId: puzzle.end_player_id };
    } else {
      // Try custom game
      const { getDb } = require('../../data/db');
      const db = getDb();
      const customGame = db.prepare('SELECT * FROM custom_games WHERE id = ?').get(puzzleId) as any;
      if (customGame) {
        game = { puzzleId, type: 'custom', forwardPath: [], backwardPath: [], searchDirection: 'forward', startPlayerId: customGame.start_player_id, endPlayerId: customGame.end_player_id, difficulty: customGame.difficulty ?? undefined };
      }
    }
  }

  if (game) {
    const gameKey = getGameKey(game.type, interaction.user.id, game.type === 'custom' ? game.puzzleId : undefined);
    activeGames.delete(gameKey);

    // Track the give-up to block future guesses on this game
    givenUpGames.add(`${interaction.user.id}:${game.type}:${game.puzzleId}`);

    // Persist give-up to stats
    const { getDb } = require('../../data/db');
    const guDb = getDb();
    const guCustomGame = game.type === 'custom'
      ? guDb.prepare('SELECT game_mode FROM custom_games WHERE id = ?').get(game.puzzleId) as { game_mode: string } | undefined
      : undefined;
    const guGameMode = game.type === 'daily' ? 'daily' : (guCustomGame?.game_mode === 'random' ? 'random' : 'custom') as 'daily' | 'custom' | 'random';
    recordGiveUp(interaction.user.id, guGameMode);

    // For insane mode, show a valid multi-team path instead of regular shortest paths
    let allPaths: number[][];
    if (game.difficulty === 'insane') {
      const mtPath = findMultiTeamPath(game.startPlayerId, game.endPlayerId, 8);
      allPaths = mtPath ? [mtPath.path] : findAllShortestPaths(game.startPlayerId, game.endPlayerId, 1);
    } else {
      allPaths = findAllShortestPaths(game.startPlayerId, game.endPlayerId, 3);
    }
    if (allPaths.length > 0) {
      const optimalLength = allPaths[0].length - 1;

      // Build path descriptions with team connections
      const pathDescriptions = allPaths.map((path, i) => {
        const parts: string[] = [];
        for (let j = 0; j < path.length; j++) {
          parts.push(`**${playerGraph.getPlayerNameWithFlag(path[j])}**`);
          if (j < path.length - 1) {
            const teams = playerGraph.getSharedTeams(path[j], path[j + 1]);
            const teamName = teams[0]?.teamAcronym ?? teams[0]?.teamName ?? '???';
            parts.push(`_via ${teamName}_`);
          }
        }
        return `**Path ${i + 1}:**\n${parts.join(' \u2192 ')}`;
      });

      const { EmbedBuilder } = require('discord.js');
      const embed = new EmbedBuilder()
        .setTitle(`\uD83D\uDEA9 You gave up! \u2014 ${optimalLength} steps optimal`)
        .setDescription(
          `${pathDescriptions.join('\n\n')}` +
          (allPaths.length < 3 ? '' : '\n\n_...and more paths exist_')
        )
        .setColor(0xED4245);

      await interaction.update({
        content: '',
        embeds: [embed],
        components: [],
      });

      // Announce publicly
      await interaction.followUp({ content: `**${interaction.user.displayName}** has given up!` });

      // Update the original message to show "Given Up"
      await updateOriginalMessage(interaction, game, 'givenup');
      return;
    }
  }

  await interaction.update({
    content: 'You gave up on this puzzle.',
    embeds: [],
    components: [],
  });

  // Announce publicly even when no paths found
  if (game) {
    await interaction.followUp({ content: `**${interaction.user.displayName}** has given up!` });
    await updateOriginalMessage(interaction, game, 'givenup');
  }
}

/**
 * Update the original /random embed message to add a scoreboard entry.
 * Keeps buttons and embed intact so other players can still play.
 */
async function updateOriginalMessage(
  interaction: ButtonInteraction,
  game: import('./gameState').GameState,
  status: 'completed' | 'givenup',
  pathLength?: number,
  optimalLength?: number
): Promise<void> {
  const msgKey = `${game.type}:${game.puzzleId}`;
  const msgRef = originalMessages.get(msgKey);
  if (!msgRef) return;

  try {
    const channel = await interaction.client.channels.fetch(msgRef.channelId);
    if (!channel || !channel.isTextBased()) return;

    const message = await channel.messages.fetch(msgRef.messageId);
    if (!message) return;

    const originalEmbed = message.embeds[0];
    if (!originalEmbed) return;

    // Build the new scoreboard line
    let scoreLine: string;
    if (status === 'completed' && pathLength != null && optimalLength != null) {
      const par = calculatePar(optimalLength);
      const scoreToPar = pathLength - par;
      const rating = getGameRating(scoreToPar);
      const scoreStr = formatScoreToPar(scoreToPar);
      scoreLine = `**${interaction.user.displayName}** — ${rating} (${scoreStr}) | ${pathLength} steps`;
    } else if (status === 'completed') {
      scoreLine = `\u2705 **${interaction.user.displayName}** — Completed`;
    } else {
      scoreLine = `\uD83D\uDEA9 **${interaction.user.displayName}** — Gave up`;
    }

    // Append scoreboard to existing embed description
    let desc = originalEmbed.description ?? '';

    // Check if scoreboard section already exists
    const scoreboardHeader = '\n\n\uD83D\uDCCA **Scoreboard:**';
    if (!desc.includes('\uD83D\uDCCA **Scoreboard:**')) {
      desc += scoreboardHeader;
    }
    desc += `\n${scoreLine}`;

    // Truncate if approaching Discord's 4096 char limit
    if (desc.length > 3900) {
      const headerIdx = desc.indexOf(scoreboardHeader);
      if (headerIdx >= 0) {
        const lines = desc.slice(headerIdx + scoreboardHeader.length).split('\n').filter(Boolean);
        // Keep last 10 entries
        const trimmed = lines.slice(-10).join('\n');
        desc = desc.slice(0, headerIdx) + scoreboardHeader + '\n' + trimmed;
      }
    }

    const updatedEmbed = EmbedBuilder.from(originalEmbed).setDescription(desc);

    // Keep the original buttons intact — don't remove components
    await message.edit({ embeds: [updatedEmbed], components: message.components as any });
  } catch (err) {
    console.warn('[Handler] Could not update original message:', err);
  }
  // Do NOT delete originalMessages — keep the ref so future players can also update the scoreboard
}
