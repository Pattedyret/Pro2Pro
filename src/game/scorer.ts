import { playerGraph } from './graph';

export interface ScoreResult {
  pathLength: number;
  optimalLength: number;
  par: number;
  scoreToPar: number;
  rating: string;
  isOptimal: boolean;
  shareText: string;
}

/** PAR = optimal + 2 (universal across all difficulties) */
export function calculatePar(optimalLength: number): number {
  return optimalLength + 2;
}

/** Get gaming-style rating based on score relative to par */
export function getGameRating(scoreToPar: number): string {
  if (scoreToPar <= -2) return 'Perfect';
  if (scoreToPar === -1) return 'Great';
  if (scoreToPar === 0) return 'Good';
  if (scoreToPar <= 2) return 'Okay';
  if (scoreToPar <= 4) return 'Nice Try';
  return 'Overcooked';
}

/** Format score-to-par as a string like "+2", "-1", or "E" (even) */
export function formatScoreToPar(scoreToPar: number): string {
  if (scoreToPar === 0) return 'E';
  return scoreToPar > 0 ? `+${scoreToPar}` : `${scoreToPar}`;
}

/**
 * Score a completed path and generate share text.
 */
export function scorePath(
  playerIds: number[],
  optimalLength: number,
  puzzleNumber: number,
  difficulty: string,
  difficultyStars: number,
  optimalPathNames?: string[] | null,
  username?: string
): ScoreResult {
  const pathLength = playerIds.length - 1;
  const par = calculatePar(optimalLength);
  const scoreToPar = pathLength - par;
  const isOptimal = pathLength === optimalLength;
  const rating = getGameRating(scoreToPar);

  const blocks = generateShareBlocks(pathLength, par);
  const starEmoji = '\u2B50'.repeat(difficultyStars);
  const pathNames = playerIds.map(id => playerGraph.getPlayerNameWithFlag(id));
  const scoreStr = formatScoreToPar(scoreToPar);

  const lines = [
    username ? `${username}'s Pro2Pro #${puzzleNumber} — ${rating} (${scoreStr})` : `Pro2Pro #${puzzleNumber} — ${rating} (${scoreStr})`,
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

  return { pathLength, optimalLength, par, scoreToPar, isOptimal, shareText, rating };
}

/**
 * Generate share blocks relative to PAR.
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
