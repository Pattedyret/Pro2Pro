import { GameState } from '../bot/interactions/gameState';

interface WebGameSession {
  game: GameState;
  userId: string;
  lastActivity: number;
}

const sessions = new Map<string, WebGameSession>();
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

export function createWebSession(sessionId: string, userId: string, game: GameState): void {
  sessions.set(sessionId, { game, userId, lastActivity: Date.now() });
}

export function getWebSession(sessionId: string, userId: string): GameState | null {
  const session = sessions.get(sessionId);
  if (!session || session.userId !== userId) return null;
  if (Date.now() - session.lastActivity > SESSION_TTL) {
    sessions.delete(sessionId);
    return null;
  }
  session.lastActivity = Date.now();
  return session.game;
}

export function deleteWebSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// Clean expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}, 10 * 60 * 1000);
