import { useAuth } from '../hooks/useAuth';

export function Profile() {
  const { user, stats, totalPoints } = useAuth();

  if (!user) return null;

  const statCards = [
    { label: 'Total Points', value: totalPoints, color: 'text-orange-400' },
    { label: 'Games Played', value: stats?.games_played ?? 0, color: 'text-white' },
    { label: 'Games Won', value: stats?.games_won ?? 0, color: 'text-green-400' },
    { label: 'Current Streak', value: stats?.current_streak ?? 0, color: 'text-yellow-400', suffix: ' days' },
    { label: 'Max Streak', value: stats?.max_streak ?? 0, color: 'text-orange-400', suffix: ' days' },
    { label: 'Avg Path Length', value: (stats?.avg_path_length ?? 0).toFixed(1), color: 'text-purple-400', suffix: ' steps' },
  ];

  const winRate = stats?.games_played > 0
    ? ((stats.games_won / stats.games_played) * 100).toFixed(0)
    : '0';

  return (
    <div className="space-y-10">
      {/* Profile header */}
      <div className="text-center space-y-3">
        {user.avatar && (
          <img
            src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`}
            alt=""
            className="w-20 h-20 rounded-full mx-auto ring-2 ring-orange-500/50"
          />
        )}
        <h1 className="text-3xl font-bold text-white">{user.username}</h1>
        <div className="text-lg font-mono text-orange-400">{totalPoints} points</div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        {statCards.map(card => (
          <div key={card.label} className="bg-gray-900/50 border border-orange-500/20 rounded-xl p-5 text-center backdrop-blur-sm">
            <div className={`text-2xl font-mono font-bold ${card.color}`}>
              {card.value}{card.suffix ?? ''}
            </div>
            <div className="text-xs text-gray-400 mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Win rate */}
      <div className="max-w-md mx-auto bg-gray-900/50 border border-orange-500/20 rounded-xl p-6 text-center backdrop-blur-sm">
        <div className="text-4xl font-mono font-bold text-green-400">{winRate}%</div>
        <div className="text-sm text-gray-400 mt-1">Optimal Solve Rate</div>
        <div className="mt-4 w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-orange-500 h-2 rounded-full transition-all"
            style={{ width: `${winRate}%` }}
          />
        </div>
      </div>
    </div>
  );
}
