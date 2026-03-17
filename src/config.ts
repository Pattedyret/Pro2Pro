import 'dotenv/config';

export const config = {
  // Discord
  discordToken: process.env.DISCORD_TOKEN!,
  clientId: process.env.CLIENT_ID || '1480857828091625534',

  // PandaScore
  pandaScoreApiKey: process.env.PANDASCORE_API_KEY!,
  pandaScoreBaseUrl: 'https://api.pandascore.co',

  // Database
  dbPath: process.env.DB_PATH || './data/pro2pro.db',

  // Scheduler
  dailyPuzzleCron: '0 7 * * *', // 07:00 UTC = 08:00 CET
  syncIntervalHours: 6,

  // Game settings
  minPathLength: 3,
  maxPathLength: 6,
  puzzleRepeatDays: 90,

  // Difficulty tiers (daily puzzles)
  difficulty: {
    medium: { minPath: 3, maxPath: 3, label: 'Medium', stars: 2 },
    hard: { minPath: 4, maxPath: 4, label: 'Hard', stars: 3 },
    expert: { minPath: 5, maxPath: 6, label: 'Expert', stars: 4 },
  },

  // Random game difficulty tiers
  randomDifficulty: {
    easy:   { pool: 'famous' as const, minPaths: 5, minPath: 3, maxPath: 4, label: 'Easy',   emoji: '🟢' },
    medium: { pool: 'famous' as const, minPaths: 2, minPath: 5, maxPath: 6, label: 'Medium', emoji: '🟡' },
    hard:   { pool: 'famous' as const, minPaths: 1, minPath: 7, maxPath: 9, label: 'Hard',   emoji: '🔴' },
  },

  // Difficulty rotation: cycles through these
  difficultyRotation: ['medium', 'hard', 'hard', 'expert'] as const,

  // Tournament organizer classification
  // A+ tier: premier organizers only (BLAST Premier, PGL Majors, IEM, ESL Pro League)
  aPlusTierOrganizers: ['BLAST', 'PGL', 'IEM', 'ESL'] as const,
  // B+ tier: all notable organizers (includes qualifiers, opens, etc.)
  bPlusTierOrganizers: ['BLAST', 'DreamHack', 'ESL', 'PGL', 'IEM', 'StarLadder', 'EPICENTER', 'ECS', 'ELEAGUE', 'Intel', 'FACEIT', 'ESEA'] as const,
  cctTierOrganizers: ['CCT'] as const,

  // Web API
  apiPort: parseInt(process.env.PORT || process.env.API_PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'pro2pro-dev-secret-change-in-prod',
  discordClientSecret: process.env.DISCORD_CLIENT_SECRET || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
} as const;
