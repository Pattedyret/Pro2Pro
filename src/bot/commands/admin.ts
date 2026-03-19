import { ChatInputCommandInteraction } from 'discord.js';
import { config } from '../../config';
import { pandaScoreSync } from '../../data/sync/pandaScore';
import { getDb } from '../../data/db';
import { playerGraph } from '../../game/graph';

export async function handleAdmin(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.user.id !== config.adminUserId) {
    await interaction.reply({ content: 'Not authorised.', flags: 64 });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'resync') {
    await interaction.deferReply({ flags: 64 });
    try {
      await interaction.editReply('Resync started — clearing rosters and re-fetching from PandaScore. This takes several minutes...');
      const result = await pandaScoreSync.resetAndSync();
      await interaction.editReply(
        `Resync complete.\n**Teams:** ${result.teams}\n**Players:** ${result.players}\n**Roster connections:** ${result.rosters}`
      );
    } catch (err: any) {
      await interaction.editReply(`Resync failed: ${err?.message ?? err}`);
    }
  }

  if (sub === 'fix-female-flags') {
    const db = getDb();
    const result = db.prepare(`UPDATE players SET is_female = 0`).run();
    playerGraph.build();
    await interaction.reply({
      content: `Reset is_female flag on ${result.changes} players and rebuilt graph. Players incorrectly hidden from search should now appear.`,
      flags: 64,
    });
  }
}
