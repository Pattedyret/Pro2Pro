import { playerGraph } from './graph';

export interface ScoreResult {
  pathLength: number;
  optimalLength: number;
  isOptimal: boolean;
  shareText: string;
  rating: string;
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
  optimalPathNames?: string[] | null
): ScoreResult {
  const pathLength = playerIds.length - 1; // steps = edges
  const isOptimal = pathLength === optimalLength;

  const rating = isOptimal ? 'Optimal!' : pathLength <= optimalLength + 1 ? 'Great!' : 'Complete';

  const blocks = generateShareBlocks(pathLength, optimalLength);
  const starEmoji = '\u2B50'.repeat(difficultyStars);
  const pathNames = playerIds.map(id => playerGraph.getPlayerNameWithFlag(id));

  const lines = [
    `Pro2Pro #${puzzleNumber} ${isOptimal ? '\u2B50 ' : ''}${pathLength}/${optimalLength}`,
    blocks,
    `Difficulty: ${difficulty} ${starEmoji}`,
    '',
    `**Your path:** ${pathNames.join(' \u2192 ')}`,
  ];

  if (optimalPathNames && !isOptimal) {
    lines.push(`**Optimal:** ${optimalPathNames.join(' \u2192 ')}`);
  }

  const shareText = lines.join('\n');

  return { pathLength, optimalLength, isOptimal, shareText, rating };
}

/**
 * Generate Wordle-style share blocks.
 */
function generateShareBlocks(pathLength: number, optimalLength: number): string {
  const blocks: string[] = [];

  for (let i = 0; i < pathLength; i++) {
    if (i < optimalLength) {
      blocks.push('\uD83D\uDFE9'); // green square
    } else {
      blocks.push('\uD83D\uDFE8'); // yellow square - extra steps
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
