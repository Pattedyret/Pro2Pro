import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface Guild {
  guild_id: string;
  guild_name: string;
  guild_icon: string | null;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  totalPoints: number;
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  avgPathLength: number;
}

export function Leaderboard() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);

  useEffect(() => {
    api.guilds()
      .then(data => {
        setGuilds(data.guilds);
        if (data.guilds.length > 0) {
          setSelectedGuild(data.guilds[0].guild_id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedGuild) return;
    setLoadingBoard(true);
    api.leaderboard(selectedGuild)
      .then(data => setLeaderboard(data.leaderboard))
      .catch(() => setLeaderboard([]))
      .finally(() => setLoadingBoard(false));
  }, [selectedGuild]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (guilds.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>No shared servers found.</p>
        <p className="text-sm mt-1">You and the Pro2Pro bot must share at least one Discord server.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
      </div>

      {/* Guild picker */}
      <div className="flex justify-center">
        <select
          value={selectedGuild}
          onChange={e => setSelectedGuild(e.target.value)}
          className="px-4 py-2 rounded-xl bg-gray-900 border border-orange-500/30 text-white focus:outline-none focus:border-orange-400"
        >
          {guilds.map(g => (
            <option key={g.guild_id} value={g.guild_id}>{g.guild_name}</option>
          ))}
        </select>
      </div>

      {loadingBoard ? (
        <div className="flex justify-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center py-10 text-gray-400">No data yet for this server</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full max-w-3xl mx-auto">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="py-3 px-2 text-left">#</th>
                <th className="py-3 px-2 text-left">Player</th>
                <th className="py-3 px-2 text-right">Points</th>
                <th className="py-3 px-2 text-right hidden sm:table-cell">Games</th>
                <th className="py-3 px-2 text-right hidden sm:table-cell">Wins</th>
                <th className="py-3 px-2 text-right hidden md:table-cell">Streak</th>
                <th className="py-3 px-2 text-right hidden md:table-cell">Avg Steps</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr key={entry.userId} className={`border-b border-gray-800/50 ${i < 3 ? 'text-white' : 'text-gray-300'}`}>
                  <td className="py-3 px-2">
                    {entry.rank <= 3 ? (
                      <span className="text-lg">{['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'][entry.rank - 1]}</span>
                    ) : (
                      <span className="text-gray-500">{entry.rank}</span>
                    )}
                  </td>
                  <td className="py-3 px-2 font-medium">{entry.username}</td>
                  <td className="py-3 px-2 text-right font-mono text-orange-400">{entry.totalPoints}</td>
                  <td className="py-3 px-2 text-right hidden sm:table-cell text-gray-400">{entry.gamesPlayed}</td>
                  <td className="py-3 px-2 text-right hidden sm:table-cell text-gray-400">{entry.gamesWon}</td>
                  <td className="py-3 px-2 text-right hidden md:table-cell text-gray-400">{entry.currentStreak}</td>
                  <td className="py-3 px-2 text-right hidden md:table-cell text-gray-400">{entry.avgPathLength > 0 ? entry.avgPathLength.toFixed(1) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
