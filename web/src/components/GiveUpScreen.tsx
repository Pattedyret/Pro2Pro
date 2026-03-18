interface SolutionPlayer {
  id: number;
  name: string;
  nationality?: string;
}

interface GiveUpScreenProps {
  solutions: SolutionPlayer[][];
  onPlayAgain?: () => void;
}

export function GiveUpScreen({ solutions, onPlayAgain }: GiveUpScreenProps) {
  return (
    <div className="text-center space-y-8 py-6">
      {/* Heading */}
      <div className="space-y-2">
        <h2 className="text-3xl font-black text-red-400 tracking-tight">
          Given Up
        </h2>
        <p className="text-sm text-text-muted">
          {solutions.length === 1
            ? 'Here is the optimal solution:'
            : `Here are ${solutions.length} solutions:`}
        </p>
      </div>

      {/* Solutions */}
      <div className="space-y-3 max-w-xl mx-auto">
        {solutions.map((path, idx) => (
          <div
            key={idx}
            className="bg-surface border border-border rounded-xl px-4 py-3"
          >
            {solutions.length > 1 && (
              <div className="text-[10px] text-text-muted uppercase tracking-wide mb-2">
                Solution {idx + 1}
              </div>
            )}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {path.map((player, i) => (
                <span key={`${player.id}-${i}`} className="flex items-center gap-1.5">
                  <span
                    className={`text-sm font-medium ${
                      i === 0
                        ? 'text-green-400'
                        : i === path.length - 1
                          ? 'text-red-400'
                          : 'text-white'
                    }`}
                  >
                    {player.name || '???'}
                  </span>
                  {i < path.length - 1 && (
                    <span className="text-text-muted text-xs">&rarr;</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Play Again button */}
      {onPlayAgain && (
        <button
          onClick={onPlayAgain}
          className="px-8 py-3 rounded-xl bg-surface-alt border border-border text-text-secondary font-semibold hover:text-white hover:border-border-accent transition-all"
        >
          Play Again
        </button>
      )}
    </div>
  );
}
