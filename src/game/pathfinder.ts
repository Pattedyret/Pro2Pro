import { playerGraph } from './graph';

export interface PathResult {
  path: number[]; // player IDs in order
  length: number; // number of steps (edges)
}

/**
 * BFS shortest path between two players in the graph.
 * Returns null if no path exists.
 */
export function findShortestPath(startId: number, endId: number): PathResult | null {
  if (startId === endId) return { path: [startId], length: 0 };

  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const queue: number[] = [startId];
  visited.add(startId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const neighbor of playerGraph.getNeighbors(current)) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);

      if (neighbor === endId) {
        // Reconstruct path
        const path: number[] = [endId];
        let node = endId;
        while (node !== startId) {
          node = parent.get(node)!;
          path.unshift(node);
        }
        return { path, length: path.length - 1 };
      }

      queue.push(neighbor);
    }
  }

  return null; // No path exists
}

/**
 * Count the number of distinct shortest paths between two players.
 * Uses BFS level-by-level to count all shortest paths.
 */
export function countShortestPaths(startId: number, endId: number): number {
  if (startId === endId) return 1;

  const dist = new Map<number, number>();
  const pathCount = new Map<number, number>();
  const queue: number[] = [startId];

  dist.set(startId, 0);
  pathCount.set(startId, 1);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDist = dist.get(current)!;

    // If we've already found the target at a shorter distance, stop
    if (dist.has(endId) && currentDist > dist.get(endId)!) break;

    for (const neighbor of playerGraph.getNeighbors(current)) {
      const newDist = currentDist + 1;

      if (!dist.has(neighbor)) {
        // First time visiting
        dist.set(neighbor, newDist);
        pathCount.set(neighbor, pathCount.get(current)!);
        queue.push(neighbor);
      } else if (dist.get(neighbor) === newDist) {
        // Another shortest path found
        pathCount.set(neighbor, pathCount.get(neighbor)! + pathCount.get(current)!);
      }
    }
  }

  return pathCount.get(endId) ?? 0;
}

/**
 * Find a path between two players where no team is reused across ANY link.
 * Once a team connects two players, it's banned for the rest of the path.
 * Uses DFS with depth limit. Returns null if no such path exists within maxDepth.
 */
export function findMultiTeamPath(
  startId: number,
  endId: number,
  maxDepth: number
): PathResult | null {
  let bestPath: number[] | null = null;

  function dfs(current: number, path: number[], visited: Set<number>, usedTeams: Set<number>): void {
    if (bestPath && path.length >= bestPath.length) return;
    if (path.length - 1 > maxDepth) return;

    if (current === endId) {
      bestPath = [...path];
      return;
    }

    for (const neighbor of playerGraph.getNeighbors(current)) {
      if (visited.has(neighbor)) continue;

      const edgeTeams = playerGraph.getSharedTeamIds(current, neighbor);
      if (!edgeTeams || edgeTeams.length === 0) continue;

      // Check: at least one team in this edge must NOT be in usedTeams
      const hasNewTeam = edgeTeams.some(t => !usedTeams.has(t));
      if (!hasNewTeam) continue;

      // Add all edge teams to used set
      const newUsedTeams = new Set(usedTeams);
      for (const t of edgeTeams) newUsedTeams.add(t);

      visited.add(neighbor);
      path.push(neighbor);
      dfs(neighbor, path, visited, newUsedTeams);
      path.pop();
      visited.delete(neighbor);

      if (bestPath) return;
    }
  }

  const visited = new Set<number>([startId]);
  dfs(startId, [startId], visited, new Set());

  if (!bestPath) return null;
  const finalPath = bestPath as number[];
  return { path: finalPath, length: finalPath.length - 1 };
}

/**
 * Find all shortest paths between two players (up to a limit).
 * Returns an array of paths, each being an array of player IDs.
 */
export function findAllShortestPaths(
  startId: number,
  endId: number,
  maxPaths = 50
): number[][] {
  const shortestPath = findShortestPath(startId, endId);
  if (!shortestPath) return [];

  const targetLength = shortestPath.length;
  const results: number[][] = [];

  // DFS with depth limit
  function dfs(current: number, path: number[], visited: Set<number>): void {
    if (results.length >= maxPaths) return;
    if (path.length - 1 > targetLength) return;

    if (current === endId && path.length - 1 === targetLength) {
      results.push([...path]);
      return;
    }

    if (path.length - 1 >= targetLength) return;

    for (const neighbor of playerGraph.getNeighbors(current)) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      path.push(neighbor);
      dfs(neighbor, path, visited);
      path.pop();
      visited.delete(neighbor);
    }
  }

  const visited = new Set<number>([startId]);
  dfs(startId, [startId], visited);

  return results;
}
