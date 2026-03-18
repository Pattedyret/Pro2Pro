import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface PuzzleEntry {
  puzzleNumber: number;
  date: string;
  difficulty: string;
  optimalPathLength: number;
  status: 'available' | 'completed' | 'optimal';
}

const statusStyles: Record<string, string> = {
  available: 'border-gray-700 hover:border-orange-500/50',
  completed: 'border-green-500/30 bg-green-500/5',
  optimal: 'border-yellow-500/30 bg-yellow-500/5',
};

const statusBadge: Record<string, { text: string; color: string }> = {
  available: { text: 'Play', color: 'text-orange-400' },
  completed: { text: '\u2705', color: 'text-green-400' },
  optimal: { text: '\uD83C\uDFC6', color: 'text-yellow-400' },
};

export function Archive() {
  const [puzzles, setPuzzles] = useState<PuzzleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.archive()
      .then(data => setPuzzles(data.puzzles))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const completed = puzzles.filter(p => p.status !== 'available').length;
  const optimal = puzzles.filter(p => p.status === 'optimal').length;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Puzzle Archive</h1>
        <div className="mt-2 flex justify-center gap-4 text-sm text-gray-400">
          <span>{puzzles.length} puzzles</span>
          <span className="text-green-400">{completed} completed</span>
          <span className="text-yellow-400">{optimal} optimal</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {puzzles.map(puzzle => (
          <Link
            key={puzzle.puzzleNumber}
            to={`/daily/${puzzle.puzzleNumber}`}
            className={`block p-4 rounded-xl border bg-gray-900/50 backdrop-blur-sm transition-all hover:shadow-lg ${statusStyles[puzzle.status]}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-white">#{puzzle.puzzleNumber}</span>
              <span className={statusBadge[puzzle.status].color}>{statusBadge[puzzle.status].text}</span>
            </div>
            <div className="text-xs text-gray-500">{puzzle.date}</div>
            <div className="text-xs text-gray-400 mt-1 capitalize">{puzzle.difficulty} &middot; {puzzle.optimalPathLength} steps</div>
          </Link>
        ))}
      </div>

      {puzzles.length === 0 && (
        <div className="text-center py-10 text-gray-400">No puzzles yet</div>
      )}
    </div>
  );
}
