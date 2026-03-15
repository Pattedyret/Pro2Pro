import { Link } from 'react-router-dom';

const gameModes = [
  {
    title: 'Daily Puzzle',
    desc: 'A new challenge every day. Build your streak!',
    icon: '\uD83D\uDCC5',
    path: '/daily',
    color: 'cyan',
  },
  {
    title: 'Random',
    desc: 'Pick your difficulty and get a random pair.',
    icon: '\uD83C\uDFB2',
    path: '/random',
    color: 'purple',
  },
  {
    title: 'Custom',
    desc: 'Choose any two players and find the connection.',
    icon: '\uD83C\uDFAF',
    path: '/custom',
    color: 'pink',
  },
];

const colorStyles: Record<string, string> = {
  cyan: 'border-cyan-500/30 hover:border-cyan-400 hover:shadow-cyan-500/20 group-hover:text-cyan-400',
  purple: 'border-purple-500/30 hover:border-purple-400 hover:shadow-purple-500/20 group-hover:text-purple-400',
  pink: 'border-pink-500/30 hover:border-pink-400 hover:shadow-pink-500/20 group-hover:text-pink-400',
};

export function Landing() {
  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="text-center pt-16 pb-8">
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent">
            Pro2Pro
          </span>
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-gray-400 max-w-xl mx-auto">
          Connect CS2 pros through shared teams. How many steps can you find?
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <Link
            to="/daily"
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:from-cyan-400 hover:to-blue-500 transition-all shadow-lg shadow-cyan-500/25"
          >
            Play Today's Puzzle
          </Link>
        </div>
      </section>

      {/* Game Modes */}
      <section>
        <h2 className="text-center text-2xl font-bold text-white mb-8">Game Modes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {gameModes.map(mode => (
            <Link
              key={mode.path}
              to={mode.path}
              className={`group block p-6 rounded-2xl bg-gray-900/50 border backdrop-blur-sm transition-all hover:shadow-lg ${colorStyles[mode.color]}`}
            >
              <div className="text-4xl mb-3">{mode.icon}</div>
              <h3 className="text-lg font-bold text-white mb-1">{mode.title}</h3>
              <p className="text-sm text-gray-400">{mode.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-2xl mx-auto text-center space-y-6">
        <h2 className="text-2xl font-bold text-white">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Get Two Players', desc: 'You get a start and end CS2 pro' },
            { step: '2', title: 'Build the Chain', desc: 'Find players who shared a team with the next' },
            { step: '3', title: 'Complete the Path', desc: 'Connect start to end in fewest steps' },
          ].map(s => (
            <div key={s.step} className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold mx-auto">
                {s.step}
              </div>
              <h3 className="font-bold text-white">{s.title}</h3>
              <p className="text-sm text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
