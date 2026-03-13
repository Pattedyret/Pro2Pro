import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getTodayPuzzle } from '../../data/models/puzzle';
import { getUserAttempt, getLeaderboard } from '../../data/models/userStats';
import {
  createPuzzleEmbed,
  createLeaderboardEmbed,
} from '../interactions/gameEmbed';
import { activeGames } from '../interactions/gameState';

export async function handlePro2Pro(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'play':
      await handlePlay(interaction);
      break;
    case 'leaderboard':
      await handleLeaderboard(interaction);
      break;
  }
}

async function handlePlay(interaction: ChatInputCommandInteraction): Promise<void> {
  const puzzle = getTodayPuzzle();

  if (!puzzle) {
    await interaction.reply({
      content: "No puzzle available today yet! The daily puzzle is posted at 8 AM CET.",
      flags: 64, // Ephemeral
    });
    return;
  }

  // Check if user already completed today's puzzle
  const existingAttempt = getUserAttempt(puzzle.id, interaction.user.id);
  if (existingAttempt) {
    await interaction.reply({
      content: `You've already completed today's puzzle! Your result: **${existingAttempt.path_length}/${puzzle.optimal_path_length}** steps${existingAttempt.is_optimal ? ' \u2B50 Optimal!' : ''}`,
      flags: 64,
    });
    return;
  }

  // Initialize game state for this user
  activeGames.set(`daily:${interaction.user.id}`, {
    puzzleId: puzzle.id,
    type: 'daily',
    forwardPath: [puzzle.start_player_id],
    backwardPath: [puzzle.end_player_id],
    searchDirection: 'forward',
    startPlayerId: puzzle.start_player_id,
    endPlayerId: puzzle.end_player_id,
  });

  const { embed, rows } = createPuzzleEmbed(puzzle);

  await interaction.reply({
    embeds: [embed],
    components: rows,
    flags: 64, // Ephemeral so others can't see your progress
  });
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command can only be used in a server.', flags: 64 });
    return;
  }

  const entries = getLeaderboard(interaction.guildId);
  const guildName = interaction.guild?.name ?? 'Server';
  const embed = createLeaderboardEmbed(guildName, entries);

  await interaction.reply({ embeds: [embed] });
}
