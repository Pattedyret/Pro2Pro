import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { playerGraph } from '../../game/graph';
import { findShortestPath, countShortestPaths } from '../../game/pathfinder';
import { getDb } from '../../data/db';
import { config } from '../../config';
import { originalMessages } from '../interactions/gameState';
import { calculatePar } from '../../game/scorer';

const difficultyColors = {
  easy: 0x57F287,
  medium: 0xFEE75C,
  hard: 0xED4245,
} as const;

export async function handleRandom(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const difficultyKey = (interaction.options.getString('difficulty') ?? 'medium') as keyof typeof config.randomDifficulty;
  const tier = config.randomDifficulty[difficultyKey];

  // All difficulties use famous players as start/end — paths just get longer and more complex
  let pool = playerGraph.getFamousPlayerIds();
  if (pool.length < 20) pool = playerGraph.getNotablePlayerIds();

  if (pool.length < 20) {
    await interaction.editReply({ content: 'Not enough players in the database yet.' });
    return;
  }

  // More attempts for harder difficulties since long paths between famous players are rarer
  const maxAttempts = difficultyKey === 'hard' ? 1500 : difficultyKey === 'medium' ? 400 : 200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const startId = pool[Math.floor(Math.random() * pool.length)];
    const endId = pool[Math.floor(Math.random() * pool.length)];
    if (startId === endId) continue;

    const result = findShortestPath(startId, endId);
    if (!result || result.length < 2) continue;

    // Enforce path length constraints
    if (result.length < tier.minPath || result.length > tier.maxPath) continue;

    // For hard mode, prefer paths through obscure connections (weak links, lesser-known intermediates)
    if (difficultyKey === 'hard') {
      const obscurity = playerGraph.getPathObscurityScore(result.path);
      if (obscurity < 0.3) continue; // reject paths that are too "obvious"
    }

    const player1 = playerGraph.getPlayer(startId);
    const player2 = playerGraph.getPlayer(endId);
    if (!player1 || !player2) continue;

    const numPaths = countShortestPaths(startId, endId);

    // Enforce minimum paths constraint
    if (numPaths < tier.minPaths) continue;

    // Save as custom game
    const db = getDb();
    const insertResult = db.prepare(`
      INSERT INTO custom_games (discord_user_id, guild_id, channel_id, start_player_id, end_player_id, optimal_path_length, num_valid_paths, is_feasible, game_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'random')
    `).run(
      interaction.user.id,
      interaction.guildId ?? '',
      interaction.channelId,
      startId,
      endId,
      result.length,
      numPaths
    );

    const customGameId = Number(insertResult.lastInsertRowid);

    const startFullTeams = playerGraph.getPlayerFullTeamNames(startId, 2);
    const endFullTeams = playerGraph.getPlayerFullTeamNames(endId, 2);
    const startHint = startFullTeams.length > 0
      ? `${playerGraph.getPlayerNameWithFlag(startId)} _(${startFullTeams.join(', ')})_`
      : playerGraph.getPlayerNameWithFlag(startId);
    const endHint = endFullTeams.length > 0
      ? `${playerGraph.getPlayerNameWithFlag(endId)} _(${endFullTeams.join(', ')})_`
      : playerGraph.getPlayerNameWithFlag(endId);

    const par = calculatePar(result.length);

    const embed = new EmbedBuilder()
      .setTitle(`\u26F3 Random Pro2Pro`)
      .setDescription(
        `${tier.emoji} Difficulty: **${tier.label}**\n\n` +
        `\uD83D\uDFE2 **${startHint}**  \u2192  ???  \u2192  **${endHint}** \uD83D\uDD34\n\n` +
        `\uD83C\uDFCC\uFE0F Par: **${par}** | Shortest: **${result.length}**\n\n` +
        `_Anyone can play! Click a button to start._`
      )
      .setColor(difficultyColors[difficultyKey]);

    if (player1.imageUrl) embed.setThumbnail(player1.imageUrl);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`game_search_fwd:custom:${customGameId}`)
        .setLabel('Add from Start \u2192')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`game_search_bwd:custom:${customGameId}`)
        .setLabel('\u2190 Add from End')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`game_giveup:${customGameId}`)
        .setLabel('\u274C Give Up')
        .setStyle(ButtonStyle.Danger),
    );

    const message = await interaction.editReply({ embeds: [embed], components: [row] });
    originalMessages.set(`custom:${customGameId}`, { channelId: interaction.channelId, messageId: message.id });
    return;
  }

  await interaction.editReply({
    content: 'Could not find a good random pair. Try again!',
  });
}
