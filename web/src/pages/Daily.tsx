import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useGame } from '../hooks/useGame';
import { GameBoard } from '../components/GameBoard';
import { GameModeTabs } from '../components/GameModeTabs';
import { PlayerNode } from '../components/PlayerNode';

export function Daily() {
  const { session, loading, startGame, guess, giveUp } = useGame();
  const [puzzle, setPuzzle] = useState<any>(null);
  const [loadingPuzzle, setLoadingPuzzle] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dailyPuzzle()
      .then(setPuzzle)
      .catch(() => setError('No daily puzzle available'))
      .finally(() => setLoadingPuzzle(false));
  }, []);

  const handleStart = async () => {
    try {
      await startGame({ mode: 'daily' });
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loadingPuzzle) {
    return (
      <div>
        <GameModeTabs />
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !puzzle) {
    return (
      <div>
        <GameModeTabs />
        <div className="text-center py-20 text-gray-400">{error}</div>
      </div>
    );
  }

  // Already completed this puzzle
  if (puzzle?.userAttempt) {
    return (
      <div>
        <GameModeTabs />
        <div className="text-center space-y-6 py-10">
          <h1 className="text-3xl font-bold text-white">Daily #{puzzle.puzzleNumber}</h1>
          <div className="text-4xl font-black text-orange-400">
            {puzzle.userAttempt.isOptimal ? 'Perfect' : 'Completed'}
          </div>
          <div className="bg-[#111118] border border-white/[0.08] rounded-xl p-4 max-w-xs mx-auto">
            <div className="text-2xl font-mono font-bold text-white">{puzzle.userAttempt.pathLength} steps</div>
            <div className="text-xs text-gray-400">Optimal: {puzzle.optimalPathLength}</div>
          </div>
        </div>
      </div>
    );
  }

  // Active game
  if (session) {
    return (
      <div className="space-y-6">
        <GameModeTabs />
        <h1 className="text-2xl font-bold text-center text-white">
          Daily #{puzzle?.puzzleNumber}
          <span className="ml-2 text-sm text-gray-400 capitalize">{puzzle?.difficulty}</span>
        </h1>
        <GameBoard
          forwardPath={session.forwardPath}
          backwardPath={session.backwardPath}
          teamLinks={session.teamLinks}
          complete={session.complete}
          givenUp={session.givenUp}
          result={session.result}
          solutions={session.solutions}
          error={session.error}
          loading={loading}
          onGuess={guess}
          onGiveUp={giveUp}
          optimalLength={puzzle?.optimalPathLength}
          difficulty={puzzle?.difficulty}
        />
      </div>
    );
  }

  // Pre-game info
  return (
    <div>
      <GameModeTabs />
      <div className="text-center space-y-8 py-10">
        <div>
          <h1 className="text-3xl font-bold text-white">Daily #{puzzle?.puzzleNumber}</h1>
          <p className="text-sm text-gray-400 mt-1">{puzzle?.date}</p>
        </div>

        <div className="flex justify-center gap-8 sm:gap-16">
          <PlayerNode
            name={puzzle?.startPlayer?.name ?? '?'}
            imageUrl={puzzle?.startPlayer?.imageUrl}
            variant="start"
            size="lg"
          />
          <div className="flex items-center pt-4">
            <div className="flex gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
              <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
            </div>
          </div>
          <PlayerNode
            name={puzzle?.endPlayer?.name ?? '?'}
            imageUrl={puzzle?.endPlayer?.imageUrl}
            variant="end"
            size="lg"
          />
        </div>

        <div className="flex justify-center gap-6 text-sm text-gray-400">
          <span>Difficulty: <span className="text-white capitalize">{puzzle?.difficulty}</span></span>
          <span>Optimal: <span className="text-orange-400 font-mono">{puzzle?.optimalPathLength}</span> steps</span>
        </div>

        <button
          onClick={handleStart}
          disabled={loading}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold hover:from-orange-400 hover:to-amber-500 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50"
        >
          {loading ? 'Starting...' : 'Start Game'}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}
