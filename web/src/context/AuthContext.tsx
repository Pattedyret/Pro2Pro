import { createContext, useState, useEffect, type ReactNode } from 'react';
import { api, setToken, clearToken, isAuthenticated } from '../api/client';

interface User {
  id: string;
  username: string;
  avatar: string | null;
}

interface AuthState {
  user: User | null;
  stats: any;
  totalPoints: number;
  loading: boolean;
  loggedIn: boolean;
  login: (code: string, redirectUri: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  user: null, stats: null, totalPoints: 0, loading: true, loggedIn: false,
  login: async () => {}, logout: () => {}, refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.me();
      setUser(data.user);
      setStats(data.stats);
      setTotalPoints(data.totalPoints);
    } catch {
      setUser(null);
      clearToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (code: string, redirectUri: string) => {
    const data = await api.login(code, redirectUri);
    setToken(data.token);
    setUser(data.user);
    await refresh();
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setStats(null);
    setTotalPoints(0);
  };

  return (
    <AuthContext.Provider value={{ user, stats, totalPoints, loading, loggedIn: !!user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
