import { ConnectionGraph } from './ConnectionGraph';

interface PointsBreakdown {
  reason: string;
  points: number;
}

interface CompletionResult {
  pathLength: number;
  optimalLength: number;
  par: number;
  scoreToPar: number;
  rating: string;
  isOptimal: boolean;
  points?: { total: number; breakdown: PointsBreakdown[] } | null;
  path?: { id: number; name: string; nationality?: string; imageUrl?: string }[];
}

interface TeamLink {
  fromId: number;
  toId: number;
  teams: { name: string; imageUrl: string | null }[];
}

interface CompletionScreenProps {
  result: CompletionResult;
  teamLinks: TeamLink[];
  difficulty?: string;
  onPlayAgain?: () => void;
}

const ratingColors: Record<string, string> = {
  Perfect: 'text-emerald-400',
  Great: 'text-green-400',
  Good: 'text-orange-400',
  Okay: 'text-yellow-400',
  'Nice Try': 'text-amber-400',
  Overcooked: 'text-red-400',
};

const ratingGlows: Record<string, string> = {
  Perfect: 'shadow-emerald-500/30',
  Great: 'shadow-green-500/20',
  Good: 'shadow-orange-500/20',
  Okay: 'shadow-yellow-500/20',
  'Nice Try': 'shadow-amber-500/20',
  Overcooked: 'shadow-red-500/20',
};

function formatScoreToPar(scoreToPar: number): string {
  if (scoreToPar === 0) return 'E';
  if (scoreToPar > 0) return `+${scoreToPar}`;
  return `${scoreToPar}`;
}

export function CompletionScreen({
  result,
  teamLinks,
  difficulty,
  onPlayAgain,
}: CompletionScreenProps) {
  const colorClass = ratingColors[result.rating] ?? 'text-gray-400';
  const glowClass = ratingGlows[result.rating] ?? '';

  return (
    <div className="space-y-8 text-center">
      {/* Rating label */}
      <div className="space-y-2">
        <h2
          className={`text-4xl sm:text-5xl font-black tracking-tight ${colorClass} drop-shadow-lg`}
        >
          {result.rating}
        </h2>
        <p className="text-sm text-gray-400">
          {result.isOptimal
            ? 'You found the shortest path!'
            : `${formatScoreToPar(result.scoreToPar)} to par`}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto">
        <div
          className={`bg-surface border border-border rounded-xl p-4 shadow-lg ${glowClass}`}
        >
          <div className="text-2xl font-mono font-bold text-white">
            {result.pathLength}
          </div>
          <div className="text-xs text-text-secondary">Steps</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-2xl font-mono font-bold text-white">
            {result.optimalLength}
          </div>
          <div className="text-xs text-text-secondary">Optimal</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-2xl font-mono font-bold text-white">
            {result.par}
          </div>
          <div className="text-xs text-text-secondary">Par</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-2xl font-mono font-bold text-orange-400">
            {result.points?.total ?? 0}
          </div>
          <div className="text-xs text-text-secondary">Points</div>
        </div>
      </div>

      {/* Difficulty badge */}
      {difficulty && (
        <div className="flex justify-center">
          <span className="text-xs text-text-muted bg-surface-alt border border-border rounded-full px-3 py-1 capitalize">
            {difficulty} difficulty
          </span>
        </div>
      )}

      {/* Points breakdown */}
      {result.points?.breakdown && result.points.breakdown.length > 0 && (
        <div className="max-w-xs mx-auto bg-surface border border-border rounded-xl p-4 space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            Points Breakdown
          </h3>
          {result.points.breakdown.map((b, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-text-secondary capitalize">{b.reason}</span>
              <span className="text-orange-400 font-mono">+{b.points}</span>
            </div>
          ))}
          <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
            <span className="text-text-secondary">Total</span>
            <span className="text-orange-400 font-mono">
              {result.points.total}
            </span>
          </div>
        </div>
      )}

      {/* Path visualization */}
      {result.path && result.path.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            Your Path
          </h3>
          <ConnectionGraph
            forwardPath={result.path}
            backwardPath={[]}
            teamLinks={teamLinks}
            complete
          />
        </div>
      )}

      {/* Play Again button */}
      {onPlayAgain && (
        <button
          onClick={onPlayAgain}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold hover:from-orange-400 hover:to-orange-500 transition-all shadow-lg shadow-orange-500/25"
        >
          Play Again
        </button>
      )}
    </div>
  );
}
