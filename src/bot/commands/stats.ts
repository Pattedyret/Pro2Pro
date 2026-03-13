import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserStats, getUserAllStats, getTopPlayerPicks, getUserRegionStats } from '../../data/models/userStats';
import { playerGraph } from '../../game/graph';
import { getRegionEmoji } from '../../game/regions';

export async function handleStats(interaction: ChatInputCommandInteraction): Promise<void> {
  const view = interaction.options.getString('view') ?? 'all';
  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  const userId = targetUser.id;
  const username = targetUser.displayName;

  const embed = view === 'daily'
    ? buildDailyEmbed(username, userId)
    : buildAllTimeEmbed(username, userId);

  await interaction.reply({ embeds: [embed] });
}

function buildAllTimeEmbed(username: string, userId: string): EmbedBuilder {
  const stats = getUserAllStats(userId);
  const totalPlayed = stats.daily_played + stats.custom_played + stats.random_played;
  const totalWon = stats.daily_won + stats.custom_won + stats.random_won;
  const winRate = totalPlayed > 0 ? Math.round((totalWon / totalPlayed) * 100) : 0;

  const embed = new EmbedBuilder()
    .setTitle(`📊 Pro2Pro Stats — ${username}`)
    .setColor(0x5865F2);

  embed.addFields(
    { name: 'Games Played', value: `${totalPlayed}`, inline: true },
    { name: 'Optimal Paths', value: `${totalWon} (${winRate}%)`, inline: true },
    {
      name: 'Breakdown',
      value: `Daily: ${stats.daily_played} | Custom: ${stats.custom_played} | Random: ${stats.random_played}`,
      inline: true,
    },
    { name: 'Current Streak', value: `🔥 ${stats.current_streak}`, inline: true },
    { name: 'Best Streak', value: `⭐ ${stats.max_streak}`, inline: true },
    { name: 'Avg Path Length', value: `${stats.avg_path_length.toFixed(1)}`, inline: true },
  );

  // Top player picks
  const picks = getTopPlayerPicks(userId, 5);
  if (picks.length > 0) {
    const pickLines = picks.map((p, i) => {
      const player = playerGraph.getPlayer(p.player_id);
      const name = player
        ? playerGraph.getPlayerNameWithFlag(p.player_id)
        : `Unknown (#${p.player_id})`;
      return `${i + 1}. ${name} (${p.pick_count} ${p.pick_count === 1 ? 'pick' : 'picks'})`;
    });
    embed.addFields({ name: '🎯 Most Picked Players', value: pickLines.join('\n') });
  }

  // Region stats
  const regions = getUserRegionStats(userId);
  if (regions.length > 0) {
    const totalPicks = regions.reduce((sum, r) => sum + r.pick_count, 0);
    const regionLines = regions.slice(0, 3).map(r => {
      const pct = Math.round((r.pick_count / totalPicks) * 100);
      const barLen = Math.round(pct / 8); // Scale to ~12 chars max
      const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 12 - barLen));
      return `${getRegionEmoji(r.region)} ${r.region} ${bar} ${pct}%`;
    });
    embed.addFields({ name: '🌍 Strongest Regions', value: regionLines.join('\n') });
  }

  embed.setFooter({
    text: `Showing all games (${stats.daily_played} daily · ${stats.custom_played} custom · ${stats.random_played} random)`,
  });

  return embed;
}

function buildDailyEmbed(username: string, userId: string): EmbedBuilder {
  const stats = getUserStats(userId);
  const winRate = stats.games_played > 0
    ? Math.round((stats.games_won / stats.games_played) * 100)
    : 0;

  const embed = new EmbedBuilder()
    .setTitle(`📊 Pro2Pro Stats — ${username}`)
    .setColor(0x5865F2)
    .addFields(
      { name: 'Games Played', value: `${stats.games_played}`, inline: true },
      { name: 'Optimal Paths', value: `${stats.games_won} (${winRate}%)`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: 'Current Streak', value: `🔥 ${stats.current_streak}`, inline: true },
      { name: 'Best Streak', value: `⭐ ${stats.max_streak}`, inline: true },
      { name: 'Avg Path Length', value: `${stats.avg_path_length.toFixed(1)}`, inline: true },
    );

  // Player picks and regions still show all-time data
  const picks = getTopPlayerPicks(userId, 5);
  if (picks.length > 0) {
    const pickLines = picks.map((p, i) => {
      const player = playerGraph.getPlayer(p.player_id);
      const name = player
        ? playerGraph.getPlayerNameWithFlag(p.player_id)
        : `Unknown (#${p.player_id})`;
      return `${i + 1}. ${name} (${p.pick_count} ${p.pick_count === 1 ? 'pick' : 'picks'})`;
    });
    embed.addFields({ name: '🎯 Most Picked Players', value: pickLines.join('\n') });
  }

  const regions = getUserRegionStats(userId);
  if (regions.length > 0) {
    const totalPicks = regions.reduce((sum, r) => sum + r.pick_count, 0);
    const regionLines = regions.slice(0, 3).map(r => {
      const pct = Math.round((r.pick_count / totalPicks) * 100);
      const barLen = Math.round(pct / 8);
      const bar = '█'.repeat(barLen) + '░'.repeat(Math.max(0, 12 - barLen));
      return `${getRegionEmoji(r.region)} ${r.region} ${bar} ${pct}%`;
    });
    embed.addFields({ name: '🌍 Strongest Regions', value: regionLines.join('\n') });
  }

  embed.setFooter({ text: 'Showing daily games only' });

  return embed;
}
