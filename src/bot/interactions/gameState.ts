/**
 * In-memory game state for active games.
 * Key format: "daily:{userId}" or "custom:{userId}:{customGameId}"
 */
export interface GameState {
  puzzleId: number;
  type: 'daily' | 'custom';
  forwardPath: number[];    // [startPlayerId, ...added from start]
  backwardPath: number[];   // [endPlayerId, ...added from end]
  searchDirection: 'forward' | 'backward';
  startPlayerId: number;
  endPlayerId: number;
}

export const activeGames = new Map<string, GameState>();

// Track give-ups: "userId:gameType:gameId" — prevents guessing after giving up
export const givenUpGames = new Set<string>();

export function getGameKey(type: 'daily' | 'custom', userId: string, customGameId?: number): string {
  if (type === 'custom' && customGameId !== undefined) {
    return `custom:${userId}:${customGameId}`;
  }
  return `daily:${userId}`;
}

/** Merge forward and backward paths into a single complete path.
 *  Deduplicates the junction point when forward reaches the backward anchor
 *  (direct completion) or backward reaches the forward anchor. */
export function getFullPath(game: GameState): number[] {
  const bwdReversed = game.backwardPath.slice().reverse();
  // If forward tip == backward anchor (first of reversed), deduplicate the junction
  if (game.forwardPath.length > 0 && bwdReversed.length > 0 &&
      game.forwardPath[game.forwardPath.length - 1] === bwdReversed[0]) {
    return [...game.forwardPath, ...bwdReversed.slice(1)];
  }
  return [...game.forwardPath, ...bwdReversed];
}

/** Get step count for in-progress game (excludes the start/end which are given) */
export function getStepCount(game: GameState): number {
  return (game.forwardPath.length - 1) + (game.backwardPath.length - 1);
}
