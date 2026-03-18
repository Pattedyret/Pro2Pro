import { Link, useLocation } from 'react-router-dom';

const tabs = [
  { label: 'Daily', path: '/daily' },
  { label: 'Random', path: '/random' },
  { label: 'Custom', path: '/custom' },
];

export function GameModeTabs() {
  const { pathname } = useLocation();
  return (
    <div className="flex justify-center gap-1 mb-8">
      {tabs.map(tab => {
        const active = pathname.startsWith(tab.path);
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              active
                ? 'bg-orange-500/15 border border-orange-500/40 text-orange-400'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
