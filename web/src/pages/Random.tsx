import { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { GameBoard } from '../components/GameBoard';
import { DifficultyPicker } from '../components/DifficultyPicker';

export function Random() {
  const { session, loading, startGame, guess, giveUp, reset } = useGame();
  const [gameInfo, setGameInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDifficultySelect = async (difficulty: 'easy' | 'medium' | 'hard') => {
    setError(null);
    try {
      const data = await startGame({ mode: 'random', difficulty });
      setGameInfo(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePlayAgain = () => {
    reset();
    setGameInfo(null);
  };

  if (!session && !gameInfo) {
    return (
      <div className="space-y-8 py-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Random Game</h1>
          <p className="text-gray-400 mt-2">Choose your difficulty</p>
        </div>
        <DifficultyPicker onSelect={handleDifficultySelect} disabled={loading} />
        {loading && (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && <p className="text-center text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Random Game</h1>
        {gameInfo?.difficulty && (
          <span className="text-sm text-gray-400 capitalize">{gameInfo.difficulty}</span>
        )}
      </div>

      {session && (
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
          optimalLength={gameInfo?.optimalPathLength}
          difficulty={gameInfo?.difficulty}
        />
      )}

      {(session?.complete || session?.givenUp) && (
        <div className="flex justify-center">
          <button
            onClick={handlePlayAgain}
            className="px-6 py-2 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500/50 transition-all"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
