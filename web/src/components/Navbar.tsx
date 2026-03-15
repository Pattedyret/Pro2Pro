import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Navbar() {
  const { user, loggedIn, logout, totalPoints } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-cyan-500/20 bg-black/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
          Pro2Pro
        </Link>

        <div className="hidden md:flex items-center gap-6 text-sm text-gray-300">
          <Link to="/daily" className="hover:text-cyan-400 transition-colors">Daily</Link>
          <Link to="/archive" className="hover:text-cyan-400 transition-colors">Archive</Link>
          <Link to="/random" className="hover:text-cyan-400 transition-colors">Random</Link>
          <Link to="/custom" className="hover:text-cyan-400 transition-colors">Custom</Link>
          <Link to="/leaderboard" className="hover:text-cyan-400 transition-colors">Leaderboard</Link>
        </div>

        <div className="flex items-center gap-3">
          {loggedIn && (
            <>
              <span className="text-xs text-cyan-400 font-mono">{totalPoints} pts</span>
              <Link to="/profile" className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors">
                {user?.avatar && (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`}
                    alt=""
                    className="w-7 h-7 rounded-full ring-1 ring-cyan-500/50"
                  />
                )}
                <span>{user?.username}</span>
              </Link>
              <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 transition-colors">
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
