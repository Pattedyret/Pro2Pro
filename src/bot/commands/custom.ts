import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import { playerGraph, PlayerNode } from '../../game/graph';
import { findShortestPath, countShortestPaths } from '../../game/pathfinder';

/** Resolve a player from autocomplete ID or manual name input. */
function resolvePlayer(input: string): PlayerNode | undefined {
  const id = Number(input);
  if (!isNaN(id) && id > 0) {
    return playerGraph.getPlayer(id);
  }
  return playerGraph.findPlayerByName(input);
}
import { createPuzzleEmbed } from '../interactions/gameEmbed';
import { activeGames, originalMessages } from '../interactions/gameState';
import { getDb } from '../../data/db';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { calculatePar } from '../../game/scorer';

export async function handleCustom(interaction: ChatInputCommandInteraction): Promise<void> {
  const player1Input = interaction.options.getString('player1', true);
  const player2Input = interaction.options.getString('player2', true);

  // Autocomplete sends player IDs; manual input sends names
  const player1 = resolvePlayer(player1Input);
  const player2 = resolvePlayer(player2Input);

  if (!player1) {
    await interaction.reply({ content: `Player "${player1Input}" not found.`, flags: 64 });
    return;
  }

  if (!player2) {
    await interaction.reply({ content: `Player "${player2Input}" not found.`, flags: 64 });
    return;
  }

  if (player1.id === player2.id) {
    await interaction.reply({ content: "Both players are the same!", flags: 64 });
    return;
  }

  await interaction.deferReply();

  // Find shortest path
  const result = findShortestPath(player1.id, player2.id);

  if (!result) {
    await interaction.editReply({
      content: `No connection found between **${player1.name}** and **${player2.name}**. They don't share any team roster chain.`,
    });
    return;
  }

  const numPaths = countShortestPaths(player1.id, player2.id);

  // Save custom game to DB
  const db = getDb();
  const insertResult = db.prepare(`
    INSERT INTO custom_games (discord_user_id, guild_id, channel_id, start_player_id, end_player_id, optimal_path_length, num_valid_paths, is_feasible, game_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'custom')
  `).run(
    interaction.user.id,
    interaction.guildId ?? '',
    interaction.channelId,
    player1.id,
    player2.id,
    result.length,
    numPaths
  );

  const customGameId = Number(insertResult.lastInsertRowid);

  const startTeam = playerGraph.getPlayerCurrentTeam(player1.id);
  const endTeam = playerGraph.getPlayerCurrentTeam(player2.id);
  const startHint = startTeam ? `${playerGraph.getPlayerNameWithFlag(player1.id)} _(${startTeam})_` : playerGraph.getPlayerNameWithFlag(player1.id);
  const endHint = endTeam ? `${playerGraph.getPlayerNameWithFlag(player2.id)} _(${endTeam})_` : playerGraph.getPlayerNameWithFlag(player2.id);

  const par = calculatePar(result.length);

  const embed = new EmbedBuilder()
    .setTitle(`\u26F3 Custom Pro2Pro`)
    .setDescription(
      `\uD83D\uDFE2 **${startHint}**  \u2192  ???  \u2192  **${endHint}** \uD83D\uDD34\n\n` +
      `\uD83C\uDFCC\uFE0F Par: **${par}** | Shortest: **${result.length}**\n\n` +
      `_Anyone can play! Click a button to start._`
    )
    .setColor(0xEB459E);

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
}

export async function handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused();

  if (focused.length < 1) {
    await interaction.respond([]);
    return;
  }

  const results = playerGraph.searchPlayers(focused, 25);
  await interaction.respond(
    results.map(p => ({
      name: playerGraph.getAutocompleteName(p.id),
      value: String(p.id),
    }))
  );
}
