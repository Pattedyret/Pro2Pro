import {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import { config } from '../config';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

/**
 * Register slash commands with Discord.
 */
export async function registerCommands(): Promise<void> {
  const commands = [
    new SlashCommandBuilder()
      .setName('pro2pro')
      .setDescription('Play the Pro2Pro daily puzzle')
      .addSubcommand(sub =>
        sub.setName('play').setDescription("Play today's daily puzzle")
      )
      .addSubcommand(sub =>
        sub.setName('leaderboard').setDescription('View the server leaderboard')
      ),

    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('View Pro2Pro statistics')
      .addStringOption(opt =>
        opt.setName('view').setDescription('Which stats to show')
          .addChoices(
            { name: 'All Games', value: 'all' },
            { name: 'Daily Only', value: 'daily' },
          )
      )
      .addUserOption(opt =>
        opt.setName('user').setDescription("View another player's stats")
      ),

    new SlashCommandBuilder()
      .setName('random')
      .setDescription('Start a random Pro2Pro game with two random players')
      .addStringOption(opt =>
        opt
          .setName('difficulty')
          .setDescription('Puzzle difficulty level')
          .setRequired(false)
          .addChoices(
            { name: '🟢 Easy — Famous players, many paths', value: 'easy' },
            { name: '🟡 Medium — Notable players, moderate paths', value: 'medium' },
            { name: '🔴 Hard — All players, fewer paths', value: 'hard' },
          )
      ),

    new SlashCommandBuilder()
      .setName('custom')
      .setDescription('Start a custom Pro2Pro game between two players')
      .addStringOption(opt =>
        opt
          .setName('player1')
          .setDescription('Starting player name')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption(opt =>
        opt
          .setName('player2')
          .setDescription('Ending player name')
          .setRequired(true)
          .setAutocomplete(true)
      ),
  ];

  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  console.log('[Bot] Registering slash commands...');
  await rest.put(
    Routes.applicationCommands(config.clientId),
    { body: commands.map(c => c.toJSON()) }
  );
  console.log('[Bot] Slash commands registered');
}
