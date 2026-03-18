import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

interface Player {
  id: number;
  name: string;
  nationality?: string;
  imageUrl?: string;
  teams?: string[];
  fullTeamNames?: string[];
}

interface PlayerSearchProps {
  onSelect: (player: Player) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PlayerSearch({ onSelect, placeholder = 'Search player...', disabled }: PlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Player[]>([]);
  const [fuzzy, setFuzzy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchPlayers(query);
        setResults(data.players);
        setFuzzy(data.fuzzy);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (player: Player) => {
    onSelect(player);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl bg-gray-900/80 border border-orange-500/30 text-white placeholder-gray-500 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/50 transition-all backdrop-blur-sm"
      />
      {searching && (
        <div className="absolute right-3 top-3.5">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {showResults && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-gray-900/95 border border-orange-500/20 rounded-xl backdrop-blur-xl shadow-2xl shadow-orange-500/10 max-h-80 overflow-y-auto z-50">
          {fuzzy && (
            <div className="px-4 py-2 text-xs text-yellow-400 border-b border-gray-800">
              Did you mean...
            </div>
          )}
          {results.map(player => (
            <button
              key={player.id}
              onClick={() => handleSelect(player)}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-orange-500/10 transition-colors text-left border-b border-gray-800/50 last:border-0"
            >
              {player.imageUrl ? (
                <img src={player.imageUrl} alt="" className="w-8 h-8 rounded-full bg-gray-800" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-xs text-gray-500">?</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{player.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {player.fullTeamNames?.join(', ') || player.teams?.join(', ') || 'Unknown'}
                </div>
              </div>
              {player.nationality && (
                <span className="text-xs text-gray-500">{player.nationality}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {showResults && query.length >= 1 && !searching && results.length === 0 && (
        <div className="absolute top-full mt-2 w-full bg-gray-900/95 border border-orange-500/20 rounded-xl backdrop-blur-xl p-4 text-center text-sm text-gray-400">
          No players found
        </div>
      )}
    </div>
  );
}
