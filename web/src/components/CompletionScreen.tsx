interface PathPlayer {
  id: number;
  name: string;
  nationality?: string;
  imageUrl?: string | null;
}

interface PathTeamLink {
  fromId: number;
  toId: number;
  teams: { name: string; fullName?: string; imageUrl: string | null }[];
}

interface CompletionResult {
  pathLength: number;
  optimalLength: number;
  par: number;
  scoreToPar: number;
  rating: string;
  isOptimal: boolean;
  points?: { total: number; breakdown: { reason: string; points: number }[] } | null;
  path?: PathPlayer[];
  pathTeamLinks?: PathTeamLink[];
}

interface CompletionScreenProps {
  result: CompletionResult;
  teamLinks: { fromId: number; toId: number; teams: { name: string; imageUrl: string | null }[] }[];
  difficulty?: string;
  onPlayAgain?: () => void;
}

const ratingConfig: Record<string, { color: string; bg: string; border: string }> = {
  Perfect: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  Great: { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  Good: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  Okay: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
  'Nice Try': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  Overcooked: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

function formatScoreToPar(scoreToPar: number): string {
  if (scoreToPar === 0) return 'E';
  if (scoreToPar > 0) return `+${scoreToPar}`;
  return `${scoreToPar}`;
}

/** Pick the most notable team logo for display between two players */
function pickBestTeam(teams: { name: string; fullName?: string; imageUrl: string | null }[]) {
  // Prefer teams with logos, then pick first
  return teams.find(t => t.imageUrl) ?? teams[0] ?? null;
}

/** A single player tile in the path */
function PathTile({
  player,
  variant,
}: {
  player: PathPlayer;
  variant: 'start' | 'end' | 'intermediate';
}) {
  const borderColor =
    variant === 'start'
      ? 'ring-green-500'
      : variant === 'end'
      ? 'ring-red-500'
      : 'ring-orange-500';

  const nameBg =
    variant === 'start'
      ? 'bg-green-500/10 text-green-400'
      : variant === 'end'
      ? 'bg-red-500/10 text-red-400'
      : 'bg-orange-500/10 text-orange-400';

  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-2 ${borderColor} overflow-hidden bg-[#1a1a24] flex-shrink-0`}
      >
        {player.imageUrl ? (
          <img
            src={player.imageUrl}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg font-bold text-gray-500">
            {player.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <span
        className={`text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full truncate max-w-[5rem] ${nameBg}`}
      >
        {player.name}
      </span>
    </div>
  );
}

/** Team logo connector between two player tiles */
function TeamConnector({
  team,
}: {
  team: { name: string; fullName?: string; imageUrl: string | null } | null;
}) {
  if (!team) {
    return <div className="w-6 sm:w-8 h-px bg-gray-700 self-center mt-[-12px]" />;
  }

  return (
    <div className="flex flex-col items-center gap-0.5 self-start pt-3 sm:pt-4 mx-[-2px]">
      {team.imageUrl ? (
        <img
          src={team.imageUrl}
          alt={team.name}
          title={team.fullName ?? team.name}
          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain bg-white/5 p-0.5"
        />
      ) : (
        <div
          title={team.fullName ?? team.name}
          className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/25 whitespace-nowrap"
        >
          {team.name}
        </div>
      )}
      <div className="w-6 sm:w-8 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
    </div>
  );
}

export function CompletionScreen({
  result,
  teamLinks,
  difficulty,
  onPlayAgain,
}: CompletionScreenProps) {
  const config = ratingConfig[result.rating] ?? ratingConfig.Good;
  const path = result.path ?? [];

  // Use pathTeamLinks from API if available, otherwise fall back to accumulated teamLinks
  const links = result.pathTeamLinks ?? teamLinks;

  function findTeam(fromId: number, toId: number) {
    const link = links.find(
      l =>
        (l.fromId === fromId && l.toId === toId) ||
        (l.fromId === toId && l.toId === fromId),
    );
    return link ? pickBestTeam(link.teams) : null;
  }

  return (
    <div className="space-y-8">
      {/* Rating banner — Wordle style */}
      <div className={`text-center py-6 rounded-2xl border ${config.bg} ${config.border}`}>
        <h2 className={`text-4xl sm:text-5xl font-black tracking-tight ${config.color}`}>
          {result.rating}
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          {result.isOptimal
            ? 'Shortest path found!'
            : `${formatScoreToPar(result.scoreToPar)} to par`}
        </p>
      </div>

      {/* Path visualization — the hero section */}
      {path.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-center text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Your Path
          </h3>

          {/* Desktop: horizontal flow */}
          <div className="hidden sm:flex items-start justify-center gap-1 overflow-x-auto py-2 px-4">
            {path.map((player, i) => {
              const variant =
                i === 0 ? 'start' : i === path.length - 1 ? 'end' : 'intermediate';
              const nextPlayer = path[i + 1];
              const team = nextPlayer ? findTeam(player.id, nextPlayer.id) : null;

              return (
                <div key={player.id} className="flex items-start">
                  <PathTile player={player} variant={variant as 'start' | 'end' | 'intermediate'} />
                  {nextPlayer && (
                    <TeamConnector team={team} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile: stacked vertical cards */}
          <div className="sm:hidden space-y-2 px-2">
            {path.map((player, i) => {
              const variant =
                i === 0 ? 'start' : i === path.length - 1 ? 'end' : 'intermediate';
              const nextPlayer = path[i + 1];
              const team = nextPlayer ? findTeam(player.id, nextPlayer.id) : null;

              const borderCol =
                variant === 'start'
                  ? 'border-l-green-500'
                  : variant === 'end'
                  ? 'border-l-red-500'
                  : 'border-l-orange-500';

              return (
                <div key={player.id}>
                  <div
                    className={`flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] border-l-2 ${borderCol} rounded-lg px-3 py-2.5`}
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1a1a24] flex-shrink-0">
                      {player.imageUrl ? (
                        <img src={player.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm font-bold text-gray-500">
                          {player.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{player.name}</div>
                    </div>
                    {team && (
                      <div className="flex-shrink-0">
                        {team.imageUrl ? (
                          <img
                            src={team.imageUrl}
                            alt={team.name}
                            className="w-6 h-6 rounded object-contain bg-white/5 p-0.5"
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                            {team.name}
                          </span>
                        )}
                      </div>
                    )}
                    {nextPlayer && (
                      <span className="text-gray-600 text-xs">↓</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats — Wordle-style row */}
      <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
        {[
          { label: 'Steps', value: result.pathLength, highlight: false },
          { label: 'Optimal', value: result.optimalLength, highlight: false },
          { label: 'Par', value: result.par, highlight: false },
          { label: 'Points', value: result.points?.total ?? 0, highlight: true },
        ].map(stat => (
          <div
            key={stat.label}
            className="text-center bg-white/[0.03] border border-white/[0.06] rounded-xl py-3"
          >
            <div
              className={`text-xl font-mono font-bold ${
                stat.highlight ? 'text-orange-400' : 'text-white'
              }`}
            >
              {stat.value}
            </div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Difficulty + Score to par */}
      <div className="flex justify-center gap-4 text-xs text-gray-500">
        {difficulty && <span className="capitalize">{difficulty} difficulty</span>}
        <span>{formatScoreToPar(result.scoreToPar)} to par</span>
      </div>

      {/* Points breakdown */}
      {result.points?.breakdown && result.points.breakdown.length > 0 && (
        <div className="max-w-xs mx-auto bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-1.5">
          {result.points.breakdown.map((b, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-400 capitalize">{b.reason}</span>
              <span className="text-orange-400 font-mono text-xs">+{b.points}</span>
            </div>
          ))}
        </div>
      )}

      {/* Play Again */}
      {onPlayAgain && (
        <div className="flex justify-center">
          <button
            onClick={onPlayAgain}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold hover:from-orange-400 hover:to-amber-500 transition-all shadow-lg shadow-orange-500/25"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
