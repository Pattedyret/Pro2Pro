import { playerGraph, TeamConnection } from './graph';

export interface ValidationStep {
  playerId: number;
  playerName: string;
  sharedTeams: TeamConnection[];
  valid: boolean;
}

export interface ValidationResult {
  valid: boolean;
  steps: ValidationStep[];
  error?: string;
}

/**
 * Validate a player path: each consecutive pair must share a team roster.
 */
export function validatePath(playerIds: number[], startId: number, endId: number): ValidationResult {
  if (playerIds.length < 2) {
    return { valid: false, steps: [], error: 'Path must have at least 2 players' };
  }

  if (playerIds[0] !== startId) {
    return { valid: false, steps: [], error: 'Path must start with the starting player' };
  }

  if (playerIds[playerIds.length - 1] !== endId) {
    return { valid: false, steps: [], error: 'Path must end with the target player' };
  }

  // Check for duplicates
  const seen = new Set<number>();
  for (const id of playerIds) {
    if (seen.has(id)) {
      const player = playerGraph.getPlayer(id);
      return {
        valid: false,
        steps: [],
        error: `Duplicate player: ${player?.name ?? id}`,
      };
    }
    seen.add(id);
  }

  const steps: ValidationStep[] = [];

  for (let i = 1; i < playerIds.length; i++) {
    const prevId = playerIds[i - 1];
    const currId = playerIds[i];
    const sharedTeams = playerGraph.getSharedTeams(prevId, currId);
    const player = playerGraph.getPlayer(currId);

    const step: ValidationStep = {
      playerId: currId,
      playerName: player?.name ?? `Unknown (${currId})`,
      sharedTeams,
      valid: sharedTeams.length > 0,
    };

    steps.push(step);

    if (!step.valid) {
      const prevPlayer = playerGraph.getPlayer(prevId);
      return {
        valid: false,
        steps,
        error: `${prevPlayer?.name ?? prevId} and ${player?.name ?? currId} never shared a team`,
      };
    }
  }

  return { valid: true, steps };
}

/**
 * Validate a single link: check if adding a player to the chain is valid.
 */
export function validateLink(fromPlayerId: number, toPlayerId: number): {
  valid: boolean;
  sharedTeams: TeamConnection[];
  error?: string;
} {
  const fromPlayer = playerGraph.getPlayer(fromPlayerId);
  const toPlayer = playerGraph.getPlayer(toPlayerId);

  if (!fromPlayer) return { valid: false, sharedTeams: [], error: 'Starting player not found' };
  if (!toPlayer) return { valid: false, sharedTeams: [], error: 'Target player not found' };

  const sharedTeams = playerGraph.getSharedTeams(fromPlayerId, toPlayerId);

  if (sharedTeams.length === 0) {
    return {
      valid: false,
      sharedTeams: [],
      error: `${fromPlayer.name} and ${toPlayer.name} never shared a team`,
    };
  }

  return { valid: true, sharedTeams };
}
