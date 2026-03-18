import { Link } from 'react-router-dom';

const gameModes = [
  {
    title: 'Daily Puzzle',
    desc: 'A new challenge every day. Build your streak!',
    path: '/daily',
    accent: 'border-orange-500/20 hover:border-orange-400/50 hover:shadow-orange-500/10',
    titleAccent: 'group-hover:text-orange-400',
  },
  {
    title: 'Random',
    desc: 'Pick your difficulty and get a random pair.',
    path: '/random',
    accent: 'border-amber-500/20 hover:border-amber-400/50 hover:shadow-amber-500/10',
    titleAccent: 'group-hover:text-amber-400',
  },
  {
    title: 'Custom',
    desc: 'Choose any two players and find the connection.',
    path: '/custom',
    accent: 'border-yellow-500/20 hover:border-yellow-400/50 hover:shadow-yellow-500/10',
    titleAccent: 'group-hover:text-yellow-400',
  },
];

const steps = [
  {
    step: '1',
    title: 'Get Two Players',
    desc: 'You receive a start and end CS2 pro',
  },
  {
    step: '2',
    title: 'Build the Chain',
    desc: 'Find players who shared a team with the next',
  },
  {
    step: '3',
    title: 'Reach the Target',
    desc: 'Connect start to end in the fewest steps',
  },
];

export function Landing() {
  return (
    <div className="space-y-24">
      {/* Hero */}
      <section className="text-center pt-20 pb-8">
        <h1 className="text-6xl sm:text-8xl font-black tracking-tight text-white">
          Pro2Pro
        </h1>
        <div className="mx-auto mt-3 h-1.5 w-32 sm:w-44 rounded-full bg-gradient-to-r from-orange-500 to-amber-500" />

        <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-xl mx-auto leading-relaxed">
          Connect CS2 pros through shared teams. How few steps can you find?
        </p>

        <div className="mt-10 flex justify-center">
          <Link
            to="/daily"
            className="px-10 py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-lg hover:from-orange-400 hover:to-amber-500 transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
          >
            Play Today's Puzzle
          </Link>
        </div>
      </section>

      {/* Game Modes */}
      <section>
        <h2 className="text-center text-2xl sm:text-3xl font-bold text-white mb-10">
          Choose Your Mode
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {gameModes.map((mode) => (
            <Link
              key={mode.path}
              to={mode.path}
              className={`group block p-6 rounded-2xl bg-white/[0.03] border transition-all hover:shadow-lg ${mode.accent}`}
            >
              <h3
                className={`text-lg font-bold text-white mb-2 transition-colors ${mode.titleAccent}`}
              >
                {mode.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {mode.desc}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-10">
          How It Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.step} className="space-y-3">
              <div className="w-12 h-12 rounded-full border-2 border-orange-500/60 flex items-center justify-center text-orange-400 font-bold text-lg mx-auto">
                {s.step}
              </div>
              <h3 className="font-bold text-white">{s.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
