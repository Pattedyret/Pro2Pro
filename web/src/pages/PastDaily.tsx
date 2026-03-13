import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useGame } from '../hooks/useGame';
import { GameBoard } from '../components/GameBoard';

export function PastDaily() {
  const { number } = useParams<{ number: string }>();
  const { session, loading, startGame, guess, giveUp } = useGame();
  const [puzzle, setPuzzle] = useState<any>(null);
  const [loadingPuzzle, setLoadingPuzzle] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!number) return;
    api.puzzleByNumber(parseInt(number))
      .then(setPuzzle)
      .catch(() => setError('Puzzle not found'))
      .finally(() => setLoadingPuzzle(false));
  }, [number]);

  const handleStart = async () => {
    if (!number) return;
    try {
      await startGame({ mode: 'daily', puzzleNumber: parseInt(number) });
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loadingPuzzle) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !puzzle) {
    return <div className="text-center py-20 text-gray-400">{error}</div>;
  }

  if (puzzle?.userAttempt) {
    return (
      <div className="text-center space-y-6 py-10">
        <h1 className="text-3xl font-bold text-white">Daily #{puzzle.puzzleNumber}</h1>
        <div className="text-6xl">{puzzle.userAttempt.isOptimal ? '\uD83C\uDFC6' : '\u2705'}</div>
        <p className="text-lg text-cyan-400">{puzzle.userAttempt.isOptimal ? 'Optimal!' : 'Completed!'}</p>
        <div className="bg-gray-900/50 border border-cyan-500/20 rounded-xl p-4 max-w-xs mx-auto">
          <div className="text-2xl font-mono font-bold text-white">{puzzle.userAttempt.pathLength} steps</div>
          <div className="text-xs text-gray-400">Optimal: {puzzle.optimalPathLength}</div>
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-center text-white">Daily #{puzzle?.puzzleNumber}</h1>
        <GameBoard
          forwardPath={session.forwardPath}
          backwardPath={session.backwardPath}
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

  return (
    <div className="text-center space-y-8 py-10">
      <h1 className="text-3xl font-bold text-white">Daily #{puzzle?.puzzleNumber}</h1>
      <p className="text-sm text-gray-400">{puzzle?.date}</p>

      <div className="flex justify-center gap-8">
        <div className="bg-gray-900/50 border border-green-500/30 rounded-xl p-6 text-center">
          <div className="font-bold text-green-400">{puzzle?.startPlayer?.name}</div>
          <div className="text-xs text-gray-400">{puzzle?.startPlayer?.teams?.join(', ')}</div>
        </div>
        <div className="flex items-center text-2xl text-gray-500">{'\u2192'}</div>
        <div className="bg-gray-900/50 border border-red-500/30 rounded-xl p-6 text-center">
          <div className="font-bold text-red-400">{puzzle?.endPlayer?.name}</div>
          <div className="text-xs text-gray-400">{puzzle?.endPlayer?.teams?.join(', ')}</div>
        </div>
      </div>

      <button
        onClick={handleStart}
        disabled={loading}
        className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50"
      >
        {loading ? 'Starting...' : 'Start Game'}
      </button>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}
