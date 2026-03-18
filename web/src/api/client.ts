const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken(): string | null {
  return localStorage.getItem('pro2pro_token');
}

export function setToken(token: string): void {
  localStorage.setItem('pro2pro_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('pro2pro_token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

function getAnonSessionId(): string {
  let id = localStorage.getItem('pro2pro_anon_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('pro2pro_anon_id', id);
  }
  return id;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-session-id': getAnonSessionId(),
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    clearToken();
    window.location.href = '/Pro2Pro/';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (code: string, redirectUri: string) =>
    apiFetch<{ token: string; user: { id: string; username: string; avatar: string } }>('/auth/discord', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    }),
  me: () => apiFetch<{ user: any; stats: any; totalPoints: number }>('/auth/me'),
  guilds: () => apiFetch<{ guilds: any[] }>('/auth/guilds'),

  // Puzzles
  dailyPuzzle: () => apiFetch<any>('/puzzles/daily'),
  puzzleByNumber: (num: number) => apiFetch<any>(`/puzzles/daily/${num}`),
  archive: () => apiFetch<{ puzzles: any[] }>('/puzzles/archive'),

  // Games
  startGame: (body: { mode: string; puzzleNumber?: number; difficulty?: string; startPlayerId?: number; endPlayerId?: number }) =>
    apiFetch<any>('/games/start', { method: 'POST', body: JSON.stringify(body) }),
  guess: (sessionId: string, playerId: number, direction: 'forward' | 'backward') =>
    apiFetch<any>(`/games/${sessionId}/guess`, { method: 'POST', body: JSON.stringify({ playerId, direction }) }),
  giveUp: (sessionId: string) =>
    apiFetch<any>(`/games/${sessionId}/giveup`, { method: 'POST' }),

  // Players
  searchPlayers: (q: string) => apiFetch<{ players: any[]; fuzzy: boolean }>(`/players/search?q=${encodeURIComponent(q)}`),

  // Leaderboard
  leaderboard: (guildId: string) => apiFetch<{ leaderboard: any[] }>(`/leaderboard/${guildId}`),
  puzzleLeaderboard: (guildId: string, puzzleId: number) =>
    apiFetch<any>(`/leaderboard/${guildId}/puzzle/${puzzleId}`),
};
