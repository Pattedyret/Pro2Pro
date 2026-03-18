interface PlayerNodeProps {
  name: string;
  imageUrl?: string | null;
  nationality?: string | null;
  variant: 'start' | 'end' | 'intermediate' | 'unknown';
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
} as const;

const variantStyles = {
  start: {
    border: 'border-green-400',
    text: 'text-green-400',
    shadow: 'shadow-green-500/20',
    bg: 'bg-green-500/10',
  },
  end: {
    border: 'border-red-400',
    text: 'text-red-400',
    shadow: 'shadow-red-500/20',
    bg: 'bg-red-500/10',
  },
  intermediate: {
    border: 'border-orange-400',
    text: 'text-orange-400',
    shadow: 'shadow-orange-500/20',
    bg: 'bg-orange-500/10',
  },
  unknown: {
    border: 'border-gray-500 border-dashed',
    text: 'text-gray-500',
    shadow: '',
    bg: 'bg-gray-800/50',
  },
} as const;

export function PlayerNode({
  name,
  imageUrl,
  nationality: _nationality,
  variant,
  size = 'md',
}: PlayerNodeProps) {
  const sizeClass = sizeMap[size];
  const style = variantStyles[variant];
  const isUnknown = variant === 'unknown';

  const displayName = isUnknown ? '???' : name;
  const initials = isUnknown
    ? '?'
    : name
        .split(/\s+/)
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`rounded-full border-2 overflow-hidden flex items-center justify-center ${sizeClass} ${style.border} ${style.shadow} ${
          style.shadow ? 'shadow-lg' : ''
        }`}
      >
        {imageUrl && !isUnknown ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center font-bold ${style.bg} ${style.text}`}
          >
            {initials}
          </div>
        )}
      </div>
      <span className={`text-xs font-medium leading-tight text-center max-w-[5rem] truncate ${style.text}`}>
        {displayName}
      </span>
    </div>
  );
}
