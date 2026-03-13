import { useState } from 'react';
import { useGame } from '../hooks/useGame';
import { GameBoard } from '../components/GameBoard';
import { PlayerSearch } from '../components/PlayerSearch';

interface SelectedPlayer {
  id: number;
  name: string;
  nationality?: string;
  imageUrl?: string;
}

export function Custom() {
  const { session, loading, startGame, guess, giveUp, reset } = useGame();
  const [startPlayer, setStartPlayer] = useState<SelectedPlayer | null>(null);
  const [endPlayer, setEndPlayer] = useState<SelectedPlayer | null>(null);
  const [gameInfo, setGameInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (!startPlayer || !endPlayer) return;
    setError(null);
    try {
      const data = await startGame({ mode: 'custom', startPlayerId: startPlayer.id, endPlayerId: endPlayer.id });
      setGameInfo(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePlayAgain = () => {
    reset();
    setStartPlayer(null);
    setEndPlayer(null);
    setGameInfo(null);
  };

  if (!session) {
    return (
      <div className="space-y-8 py-10">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Custom Game</h1>
          <p className="text-gray-400 mt-2">Pick two players and find the connection</p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <div>
            <label className="text-sm text-green-400 mb-1 block">Start Player</label>
            {startPlayer ? (
              <div className="flex items-center gap-3 bg-gray-900/50 border border-green-500/30 rounded-xl px-4 py-3">
                <span className="text-white font-medium">{startPlayer.name}</span>
                <button onClick={() => setStartPlayer(null)} className="ml-auto text-gray-500 hover:text-red-400">{'\u2715'}</button>
              </div>
            ) : (
              <PlayerSearch onSelect={(p) => setStartPlayer(p)} placeholder="Search start player..." />
            )}
          </div>

          <div>
            <label className="text-sm text-red-400 mb-1 block">End Player</label>
            {endPlayer ? (
              <div className="flex items-center gap-3 bg-gray-900/50 border border-red-500/30 rounded-xl px-4 py-3">
                <span className="text-white font-medium">{endPlayer.name}</span>
                <button onClick={() => setEndPlayer(null)} className="ml-auto text-gray-500 hover:text-red-400">{'\u2715'}</button>
              </div>
            ) : (
              <PlayerSearch onSelect={(p) => setEndPlayer(p)} placeholder="Search end player..." />
            )}
          </div>
        </div>

        {startPlayer && endPlayer && (
          <div className="flex justify-center">
            <button
              onClick={handleStart}
              disabled={loading}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Start Game'}
            </button>
          </div>
        )}

        {error && <p className="text-center text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center text-white">Custom Game</h1>
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
      />
      {(session.complete || session.givenUp) && (
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
