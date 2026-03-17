import { playerGraph } from './graph';

export interface ScoreResult {
  pathLength: number;
  optimalLength: number;
  par: number;
  scoreToPar: number;
  golfRating: string;
  golfEmoji: string;
  isOptimal: boolean;
  shareText: string;
  rating: string;
}

/** PAR = optimal + 2 (universal across all difficulties) */
export function calculatePar(optimalLength: number): number {
  return optimalLength + 2;
}

/** Get golf rating based on score relative to par */
export function getGolfRating(scoreToPar: number): { rating: string; emoji: string } {
  if (scoreToPar <= -2) return { rating: 'Eagle', emoji: '\u26F3' };       // ⛳
  if (scoreToPar === -1) return { rating: 'Birdie', emoji: '\uD83D\uDC26' }; // 🐦
  if (scoreToPar === 0)  return { rating: 'Par', emoji: '\uD83C\uDFCC\uFE0F' }; // 🏌️
  if (scoreToPar === 1)  return { rating: 'Bogey', emoji: '\uD83D\uDCA8' };    // 💨
  if (scoreToPar === 2)  return { rating: 'Double Bogey', emoji: '\uD83D\uDE2C' }; // 😬
  return { rating: 'Triple Bogey+', emoji: '\uD83D\uDE35' }; // 😵
}

/** Format score-to-par as a string like "+2", "-1", or "E" (even) */
export function formatScoreToPar(scoreToPar: number): string {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}

/**
 * Score a completed path and generate share text with golf-style scoring.
 */
export function scorePath(
  playerIds: number[],
  optimalLength: number,
  puzzleNumber: number,
  difficulty: string,
  difficultyStars: number,
  optimalPathNames?: string[] | null
): ScoreResult {
  const pathLength = playerIds.length - 1;
  const par = calculatePar(optimalLength);
  const scoreToPar = pathLength - par;
  const isOptimal = pathLength === optimalLength;
  const { rating: golfRating, emoji: golfEmoji } = getGolfRating(scoreToPar);

  const rating = golfRating;
  const blocks = generateShareBlocks(pathLength, par);
  const starEmoji = '\u2B50'.repeat(difficultyStars);
  const pathNames = playerIds.map(id => playerGraph.getPlayerNameWithFlag(id));
  const scoreStr = formatScoreToPar(scoreToPar);

  const lines = [
    `\u26F3 Pro2Pro #${puzzleNumber} — ${golfEmoji} ${golfRating} (${scoreStr})`,
    blocks,
    `Shortest: ${optimalLength} | Par: ${par} | You: ${pathLength}`,
    `Difficulty: ${difficulty} ${starEmoji}`,
    '',
    `**Your path:** ${pathNames.join(' \u2192 ')}`,
  ];

  if (optimalPathNames && !isOptimal) {
    lines.push(`**Shortest path:** ${optimalPathNames.join(' \u2192 ')}`);
  }

  const shareText = lines.join('\n');

  return { pathLength, optimalLength, par, scoreToPar, golfRating, golfEmoji, isOptimal, shareText, rating };
}

/**
 * Generate golf-style share blocks relative to PAR.
 * Green = at/under par, Yellow = over par, Red = way over par
 */
function generateShareBlocks(pathLength: number, par: number): string {
  const blocks: string[] = [];

  for (let i = 0; i < pathLength; i++) {
    if (i < par) {
      blocks.push('\uD83D\uDFE9'); // 🟩 green — within par
    } else if (i < par + 2) {
      blocks.push('\uD83D\uDFE8'); // 🟨 yellow — slightly over par
    } else {
      blocks.push('\uD83D\uDFE5'); // 🟥 red — way over par
    }
  }

  return blocks.join('');
}

/**
 * Generate the result embed description for a completed game.
 */
export function generateResultDescription(
  playerIds: number[],
  optimalLength: number
): string {
  const names = playerIds.map(id => {
    const player = playerGraph.getPlayer(id);
    return player?.name ?? `Unknown`;
  });

  return names.join(' \u2192 ');
}
