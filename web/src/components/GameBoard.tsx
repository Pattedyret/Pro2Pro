import { useState } from 'react';
import { PlayerSearch } from './PlayerSearch';
import { PlayerNode } from './PlayerNode';
import { ConnectionGraph } from './ConnectionGraph';
import { CompletionScreen } from './CompletionScreen';
import { GiveUpScreen } from './GiveUpScreen';
import type { TeamLink } from '../hooks/useGame';

interface Player {
  id: number;
  name: string;
  nationality?: string;
  imageUrl?: string;
}

interface GameBoardProps {
  forwardPath: Player[];
  backwardPath: Player[];
  teamLinks: TeamLink[];
  complete: boolean;
  givenUp: boolean;
  result: any | null;
  solutions: any[] | null;
  error: string | null;
  loading: boolean;
  onGuess: (playerId: number, direction: 'forward' | 'backward') => void;
  onGiveUp: () => void;
  onPlayAgain?: () => void;
  optimalLength?: number;
  difficulty?: string;
}

export function GameBoard({
  forwardPath,
  backwardPath,
  teamLinks,
  complete,
  givenUp,
  result,
  solutions,
  error,
  loading,
  onGuess,
  onGiveUp,
  onPlayAgain,
  optimalLength,
  difficulty,
}: GameBoardProps) {
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  if (complete && result) {
    return (
      <CompletionScreen
        result={result}
        teamLinks={teamLinks}
        difficulty={difficulty}
        onPlayAgain={onPlayAgain}
      />
    );
  }

  if (givenUp && solutions) {
    return <GiveUpScreen solutions={solutions} onPlayAgain={onPlayAgain} />;
  }

  const startPlayer = forwardPath[0];
  const endPlayer = backwardPath[0];
  const par = optimalLength ? optimalLength + 2 : undefined;
  const totalSteps = (forwardPath.length - 1) + (backwardPath.length - 1);

  return (
    <div className="space-y-6">
      {/* Goalposts — start and end players */}
      <div className="flex items-start justify-center gap-8 sm:gap-16">
        <div className="text-center">
          <PlayerNode
            name={startPlayer?.name ?? '?'}
            imageUrl={startPlayer?.imageUrl}
            nationality={startPlayer?.nationality}
            variant="start"
            size="lg"
          />
        </div>
        <div className="flex items-center pt-6 text-gray-600">
          <div className="flex gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
            <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
            <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
          </div>
        </div>
        <div className="text-center">
          <PlayerNode
            name={endPlayer?.name ?? '?'}
            imageUrl={endPlayer?.imageUrl}
            nationality={endPlayer?.nationality}
            variant="end"
            size="lg"
          />
        </div>
      </div>

      {/* Connection graph */}
      {(forwardPath.length > 1 || backwardPath.length > 1) && (
        <ConnectionGraph
          forwardPath={forwardPath}
          backwardPath={backwardPath}
          teamLinks={teamLinks}
          complete={false}
        />
      )}

      {/* Direction toggle */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setDirection('forward')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            direction === 'forward'
              ? 'bg-orange-500/15 border border-orange-500/40 text-orange-400'
              : 'bg-white/[0.03] border border-white/[0.08] text-gray-400 hover:text-white'
          }`}
        >
          From Start →
        </button>
        <button
          onClick={() => setDirection('backward')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            direction === 'backward'
              ? 'bg-orange-500/15 border border-orange-500/40 text-orange-400'
              : 'bg-white/[0.03] border border-white/[0.08] text-gray-400 hover:text-white'
          }`}
        >
          ← From End
        </button>
      </div>

      {/* Search */}
      <div className="flex justify-center">
        <PlayerSearch
          onSelect={(player) => onGuess(player.id, direction)}
          placeholder={`Search player to add ${direction === 'forward' ? 'after start chain' : 'before end chain'}...`}
          disabled={loading}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="text-center text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 max-w-md mx-auto">
          {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex justify-center items-center gap-6 text-sm text-gray-400">
        {par != null && (
          <span>Par: <span className="text-orange-400 font-mono">{par}</span></span>
        )}
        {optimalLength != null && (
          <span>Optimal: <span className="text-orange-400 font-mono">{optimalLength}</span></span>
        )}
        {totalSteps > 0 && (
          <span>Steps: <span className="text-white font-mono">{totalSteps}</span></span>
        )}
        <button
          onClick={onGiveUp}
          disabled={loading}
          className="text-red-400/60 hover:text-red-400 transition-colors text-xs"
        >
          Give Up
        </button>
      </div>
    </div>
  );
}
