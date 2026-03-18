import { useState, useCallback } from 'react';
import { api } from '../api/client';

interface Player {
  id: number;
  name: string;
  nationality?: string;
  imageUrl?: string;
}

interface TeamInfo {
  name: string;
  imageUrl: string | null;
}

export interface TeamLink {
  fromId: number;
  toId: number;
  teams: TeamInfo[];
}

export interface GameSession {
  sessionId: string;
  forwardPath: Player[];
  backwardPath: Player[];
  teamLinks: TeamLink[];
  complete: boolean;
  givenUp: boolean;
  result: any | null;
  solutions: any[] | null;
  error: string | null;
}

export function useGame() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(false);

  const startGame = useCallback(async (opts: { mode: string; puzzleNumber?: number; difficulty?: string; startPlayerId?: number; endPlayerId?: number }) => {
    setLoading(true);
    try {
      const data = await api.startGame(opts);
      setSession({
        sessionId: data.sessionId,
        forwardPath: [data.startPlayer ?? { id: 0, name: '?' }],
        backwardPath: [data.endPlayer ?? { id: 0, name: '?' }],
        teamLinks: [],
        complete: false,
        givenUp: false,
        result: null,
        solutions: null,
        error: null,
      });
      return data;
    } catch (err: any) {
      setSession(prev => prev ? { ...prev, error: err.message } : null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const guess = useCallback(async (playerId: number, direction: 'forward' | 'backward') => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await api.guess(session.sessionId, playerId, direction);
      if (!data.valid) {
        setSession(prev => prev ? { ...prev, error: data.error } : null);
        return data;
      }

      // Build team link from the guess response
      const chain = direction === 'forward' ? session.forwardPath : session.backwardPath;
      const lastPlayer = chain[chain.length - 1];
      const newTeamLink: TeamLink = {
        fromId: lastPlayer.id,
        toId: playerId,
        teams: (data.teams ?? []).map((t: any) => ({
          name: typeof t === 'string' ? t : t.name,
          imageUrl: typeof t === 'string' ? null : t.imageUrl ?? null,
        })),
      };

      if (data.complete) {
        setSession(prev => prev ? {
          ...prev,
          complete: true,
          result: data,
          teamLinks: [...prev.teamLinks, newTeamLink],
          error: null,
        } : null);
      } else {
        setSession(prev => prev ? {
          ...prev,
          forwardPath: data.forwardPath?.map((p: any) => ({
            id: p.id,
            name: p.name,
            nationality: p.nationality,
            imageUrl: p.imageUrl,
          })) ?? prev.forwardPath,
          backwardPath: data.backwardPath?.map((p: any) => ({
            id: p.id,
            name: p.name,
            nationality: p.nationality,
            imageUrl: p.imageUrl,
          })) ?? prev.backwardPath,
          teamLinks: [...prev.teamLinks, newTeamLink],
          error: null,
        } : null);
      }
      return data;
    } finally {
      setLoading(false);
    }
  }, [session]);

  const giveUp = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const data = await api.giveUp(session.sessionId);
      setSession(prev => prev ? { ...prev, givenUp: true, solutions: data.solutions, error: null } : null);
      return data;
    } finally {
      setLoading(false);
    }
  }, [session]);

  const reset = useCallback(() => setSession(null), []);

  return { session, loading, startGame, guess, giveUp, reset };
}
