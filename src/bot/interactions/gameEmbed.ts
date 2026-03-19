import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { playerGraph } from '../../game/graph';
import { config } from '../../config';
import { DailyPuzzle } from '../../data/models/puzzle';
import { calculatePar, formatScoreToPar, getGameRating } from '../../game/scorer';

/** Build a player name with team hint, e.g. "🇳🇴 s1mple _(Natus Vincere, FaZe)_" */
function nameWithTeamHint(playerId: number): string {
  const name = playerGraph.getPlayerNameWithFlag(playerId);
  const fullTeams = playerGraph.getPlayerFullTeamNames(playerId, 2);
  if (fullTeams.length > 0) return `${name} _(${fullTeams.join(', ')})_`;
  const team = playerGraph.getPlayerCurrentTeam(playerId);
  return team ? `${name} _(${team})_` : name;
}

/**
 * Create the initial daily puzzle embed.
 */
export function createPuzzleEmbed(puzzle: DailyPuzzle): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
  const startPlayer = playerGraph.getPlayer(puzzle.start_player_id);
  const startHint = nameWithTeamHint(puzzle.start_player_id);
  const endHint = nameWithTeamHint(puzzle.end_player_id);
  const tier = config.difficulty[puzzle.difficulty as keyof typeof config.difficulty];
  const stars = '\u2B50'.repeat(tier?.stars ?? 2);

  const par = calculatePar(puzzle.optimal_path_length);

  const embed = new EmbedBuilder()
    .setTitle(`\u26F3 Pro2Pro Daily #${puzzle.puzzle_number}`)
    .setDescription(
      `Difficulty: ${stars} ${tier?.label ?? puzzle.difficulty}\n\n` +
      `\uD83D\uDFE2 **${startHint}**  \u2192  ???  \u2192  **${endHint}** \uD83D\uDD34\n\n` +
      `\uD83C\uDFCC\uFE0F Par: **${par}** | Shortest: **${puzzle.optimal_path_length}**\n` +
      `Your path: _(empty)_`
    )
    .setColor(0x5865F2)
    .setFooter({ text: 'Find the shortest path between these two CS pros through shared team rosters!' });

  if (startPlayer?.imageUrl) embed.setThumbnail(startPlayer.imageUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`game_search_fwd:${puzzle.id}`)
      .setLabel('Add from Start \u2192')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`game_search_bwd:${puzzle.id}`)
      .setLabel('\u2190 Add from End')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`game_giveup:${puzzle.id}`)
      .setLabel('\u274C Give Up')
      .setStyle(ButtonStyle.Danger),
  );

  return { embed, rows: [row] };
}

/**
 * Create action buttons for game progress — two rows.
 * Row 1: Add from Start, Add from End, Finish
 * Row 2: Undo Start, Undo End, Give Up
 */
export function createProgressButtons(
  puzzleId: number,
  gameType: 'daily' | 'custom'
): ActionRowBuilder<ButtonBuilder>[] {
  const prefix = gameType === 'custom' ? `custom:${puzzleId}` : `${puzzleId}`;

  const buildRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`game_search_fwd:${prefix}`)
      .setLabel('Add from Start \u2192')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`game_search_bwd:${prefix}`)
      .setLabel('\u2190 Add from End')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`game_finish:${puzzleId}`)
      .setLabel('\u2705 Finish')
      .setStyle(ButtonStyle.Success),
  );

  const controlRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`game_undo_fwd:${puzzleId}`)
      .setLabel('\u21A9 Undo Start')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`game_undo_bwd:${puzzleId}`)
      .setLabel('\u21A9 Undo End')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`game_giveup:${puzzleId}`)
      .setLabel('\u274C Give Up')
      .setStyle(ButtonStyle.Danger),
  );

  return [buildRow, controlRow];
}

/**
 * Create the in-progress game embed showing the user's bidirectional path.
 * Works for both daily and custom games.
 */
export function createProgressEmbed(opts: {
  puzzleId: number;
  gameType: 'daily' | 'custom';
  forwardPath: number[];
  backwardPath: number[];
  startPlayerId: number;
  endPlayerId: number;
  puzzleNumber?: number;
  difficulty?: string;
  difficultyStars?: number;
  optimalLength?: number;
}): { embed: EmbedBuilder; rows: ActionRowBuilder<ButtonBuilder>[] } {
  // Forward path display with team connections
  const fwdParts: string[] = [];
  for (let i = 0; i < opts.forwardPath.length; i++) {
    // Show team hint on the start player (first in forward chain)
    const label = i === 0
      ? `**${nameWithTeamHint(opts.forwardPath[i])}**`
      : `**${playerGraph.getPlayerNameWithFlag(opts.forwardPath[i])}**`;
    fwdParts.push(label);
    if (i < opts.forwardPath.length - 1) {
      const teams = playerGraph.getSharedTeams(opts.forwardPath[i], opts.forwardPath[i + 1]);
      const teamName = teams[0]?.teamAcronym ?? teams[0]?.teamName ?? '???';
      fwdParts.push(`_via ${teamName}_`);
    }
  }

  // Backward path display (reversed for natural reading order)
  const bwdReversed = opts.backwardPath.slice().reverse();
  const bwdParts: string[] = [];
  for (let i = 0; i < bwdReversed.length; i++) {
    // Show team hint on the end player (last in reversed backward chain)
    const label = i === bwdReversed.length - 1
      ? `**${nameWithTeamHint(bwdReversed[i])}**`
      : `**${playerGraph.getPlayerNameWithFlag(bwdReversed[i])}**`;
    bwdParts.push(label);
    if (i < bwdReversed.length - 1) {
      const teams = playerGraph.getSharedTeams(bwdReversed[i], bwdReversed[i + 1]);
      const teamName = teams[0]?.teamAcronym ?? teams[0]?.teamName ?? '???';
      bwdParts.push(`_via ${teamName}_`);
    }
  }

  const stepCount = (opts.forwardPath.length - 1) + (opts.backwardPath.length - 1);
  const pathDisplay = `\uD83D\uDFE2 ${fwdParts.join(' \u2192 ')} \u2192 ??? \u2192 ${bwdParts.join(' \u2192 ')} \uD83D\uDD34`;

  let title: string;
  let description: string;

  const par = opts.optimalLength != null ? calculatePar(opts.optimalLength) : null;
  const parLine = par != null && opts.optimalLength != null
    ? `\n\uD83C\uDFCC\uFE0F Par: **${par}** | Shortest: **${opts.optimalLength}**`
    : '';

  if (opts.gameType === 'daily' && opts.puzzleNumber) {
    const stars = '\u2B50'.repeat(opts.difficultyStars ?? 2);
    title = `\u26F3 Pro2Pro Daily #${opts.puzzleNumber}`;
    description = `Difficulty: ${stars} ${opts.difficulty ?? 'medium'}\n\n` +
      pathDisplay + '\n\n' +
      `Steps so far: **${stepCount}**` + parLine;
  } else {
    title = `\u26F3 Pro2Pro Custom Game`;
    description = pathDisplay + '\n\n' + `Steps so far: **${stepCount}**` + parLine;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0xFEE75C);

  const rows = createProgressButtons(opts.puzzleId, opts.gameType);

  return { embed, rows };
}

/**
 * Create the result embed for a completed game with golf-style scoring.
 */
export function createResultEmbed(
  puzzleNumber: number,
  pathNames: string[],
  pathLength: number,
  optimalLength: number,
  isOptimal: boolean,
  shareText: string,
  difficulty: string,
  difficultyStars: number,
  optimalPathNames?: string[] | null
): EmbedBuilder {
  const par = calculatePar(optimalLength);
  const scoreToPar = pathLength - par;
  const rating = getGameRating(scoreToPar);
  const scoreStr = formatScoreToPar(scoreToPar);
  const stars = '\u2B50'.repeat(difficultyStars);

  const blocks: string[] = [];
  for (let i = 0; i < pathLength; i++) {
    if (i < par) blocks.push('\uD83D\uDFE9');      // 🟩
    else if (i < par + 2) blocks.push('\uD83D\uDFE8'); // 🟨
    else blocks.push('\uD83D\uDFE5');                   // 🟥
  }

  let description =
    '**Your path:**\n' +
    pathNames.join(' \u2192 ') + '\n\n' +
    blocks.join('') + '\n\n' +
    `Shortest: **${optimalLength}** | Par: **${par}** | You: **${pathLength}** (${scoreStr})\n\n`;

  if (optimalPathNames && !isOptimal) {
    description += '**Shortest path:**\n' +
      optimalPathNames.join(' \u2192 ') + '\n\n';
  }

  description += `Difficulty: ${difficulty} ${stars}`;

  const color = scoreToPar <= 0 ? 0x57F287 : scoreToPar <= 1 ? 0xFEE75C : 0xED4245;

  return new EmbedBuilder()
    .setTitle(`Pro2Pro #${puzzleNumber} \u2014 ${rating} (${scoreStr})`)
    .setDescription(description)
    .setColor(color);
}

/**
 * Create the player search modal.
 */
export function createSearchModal(
  puzzleId: number,
  gameType: 'daily' | 'custom' = 'daily',
  direction: 'forward' | 'backward' = 'forward'
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`search_modal:${gameType}:${puzzleId}:${direction}`)
    .setTitle('Search for a Player');

  const input = new TextInputBuilder()
    .setCustomId('player_search_input')
    .setLabel('Enter player name (or part of it)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. s1mple, device, NiKo')
    .setRequired(true)
    .setMaxLength(50);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  modal.addComponents(row);

  return modal;
}

/**
 * Create buttons for player search results.
 */
export function createPlayerButtons(
  players: { id: number; label: string }[],
  puzzleId: number,
  gameType: 'daily' | 'custom' = 'daily',
  direction: 'forward' | 'backward' = 'forward'
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  // Discord limits: max 5 buttons per row, max 5 rows, button label max 80 chars
  const maxPerRow = 4; // fewer per row since labels are longer with disambiguation
  const maxRows = 5;

  for (let i = 0; i < players.length && rows.length < maxRows; i += maxPerRow) {
    const chunk = players.slice(i, i + maxPerRow);
    const row = new ActionRowBuilder<ButtonBuilder>();

    for (const player of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`select_player:${gameType}:${puzzleId}:${player.id}:${direction}`)
          .setLabel(player.label.slice(0, 80))
          .setStyle(ButtonStyle.Secondary)
      );
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Create stats embed for a user.
 */
export function createStatsEmbed(
  username: string,
  stats: {
    games_played: number;
    games_won: number;
    current_streak: number;
    max_streak: number;
    avg_path_length: number;
  }
): EmbedBuilder {
  const winRate = stats.games_played > 0
    ? Math.round((stats.games_won / stats.games_played) * 100)
    : 0;

  return new EmbedBuilder()
    .setTitle(`\uD83D\uDCCA Pro2Pro Stats \u2014 ${username}`)
    .addFields(
      { name: 'Games Played', value: `${stats.games_played}`, inline: true },
      { name: 'Optimal Paths', value: `${stats.games_won} (${winRate}%)`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: 'Current Streak', value: `\uD83D\uDD25 ${stats.current_streak}`, inline: true },
      { name: 'Best Streak', value: `\u2B50 ${stats.max_streak}`, inline: true },
      { name: 'Avg Path Length', value: `${stats.avg_path_length.toFixed(1)}`, inline: true },
    )
    .setColor(0x5865F2);
}

/**
 * Create leaderboard embed.
 */
export function createLeaderboardEmbed(
  guildName: string,
  entries: { discord_user_id: string; daily_won: number; custom_won: number; random_won: number; daily_played: number; custom_played: number; random_played: number; avg_path_length: number; rank: number }[]
): EmbedBuilder {
  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
  const lines = entries.map((e, i) => {
    const medal = medals[i] ?? `**${e.rank}.**`;
    const won = e.daily_won + e.custom_won + e.random_won;
    const played = e.daily_played + e.custom_played + e.random_played;
    return `${medal} <@${e.discord_user_id}> \u2014 ${won}/${played} won | avg ${e.avg_path_length.toFixed(1)} steps`;
  });

  return new EmbedBuilder()
    .setTitle(`\uD83C\uDFC6 Pro2Pro Leaderboard \u2014 ${guildName}`)
    .setDescription(lines.join('\n') || 'No games played yet!')
    .setColor(0xF1C40F);
}
