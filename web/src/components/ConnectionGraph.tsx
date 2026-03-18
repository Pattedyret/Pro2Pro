import { PlayerNode } from './PlayerNode';

interface PathPlayer {
  id: number;
  name: string;
  nationality?: string;
  imageUrl?: string;
}

interface TeamLink {
  fromId: number;
  toId: number;
  teams: { name: string; imageUrl: string | null }[];
}

interface ConnectionGraphProps {
  forwardPath: PathPlayer[];
  backwardPath: PathPlayer[];
  teamLinks: TeamLink[];
  complete?: boolean;
}

function getVariant(
  index: number,
  totalLength: number,
  isComplete: boolean,
): 'start' | 'end' | 'intermediate' {
  if (index === 0) return 'start';
  if (isComplete && index === totalLength - 1) return 'end';
  return 'intermediate';
}

function findTeams(teamLinks: TeamLink[], fromId: number, toId: number) {
  const link = teamLinks.find(
    l =>
      (l.fromId === fromId && l.toId === toId) ||
      (l.fromId === toId && l.toId === fromId),
  );
  return link?.teams ?? [];
}

function TeamBadge({ team }: { team: { name: string; imageUrl: string | null } }) {
  if (team.imageUrl) {
    return (
      <img
        src={team.imageUrl}
        alt={team.name}
        title={team.name}
        className="w-5 h-5 rounded object-contain bg-surface/50"
      />
    );
  }
  return (
    <span
      title={team.name}
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30 whitespace-nowrap max-w-[4.5rem] truncate"
    >
      {team.name}
    </span>
  );
}

function TeamBadgeGroup({ teams }: { teams: { name: string; imageUrl: string | null }[] }) {
  if (teams.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {teams.map((team, i) => (
        <TeamBadge key={`${team.name}-${i}`} team={team} />
      ))}
    </div>
  );
}

/** Build the full ordered chain of players for display. */
function buildChain(
  forwardPath: PathPlayer[],
  backwardPath: PathPlayer[],
  complete?: boolean,
): { players: PathPlayer[]; gapAfterIndex: number | null } {
  if (complete) {
    // When complete, forwardPath contains the full solved path
    return { players: forwardPath, gapAfterIndex: null };
  }

  // Backward path is stored in reverse order (end player first), so reverse for display
  const reversedBackward = [...backwardPath].reverse();

  // If either path is empty, no gap needed
  if (forwardPath.length === 0 || backwardPath.length === 0) {
    return {
      players: [...forwardPath, ...reversedBackward],
      gapAfterIndex: null,
    };
  }

  return {
    players: [...forwardPath, ...reversedBackward],
    gapAfterIndex: forwardPath.length - 1,
  };
}

/** Desktop: horizontal graph with lines and team badges */
function DesktopGraph({ forwardPath, backwardPath, teamLinks, complete }: ConnectionGraphProps) {
  const { players, gapAfterIndex } = buildChain(forwardPath, backwardPath, complete);

  return (
    <div className="hidden md:flex items-start justify-center gap-0 overflow-x-auto py-4 px-2">
      {players.map((player, i) => {
        const variant = getVariant(i, players.length, !!complete);
        const showConnector = i < players.length - 1;
        const isGap = gapAfterIndex !== null && i === gapAfterIndex;
        const nextPlayer = players[i + 1];
        const teams = showConnector && !isGap && nextPlayer
          ? findTeams(teamLinks, player.id, nextPlayer.id)
          : [];

        return (
          <div key={`node-${player.id}-${i}`} className="flex items-start">
            <PlayerNode
              name={player.name}
              imageUrl={player.imageUrl}
              nationality={player.nationality}
              variant={variant}
              size="md"
            />
            {showConnector && (
              <div className="flex flex-col items-center justify-start pt-5 mx-1">
                {isGap ? (
                  /* Gap indicator */
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-px bg-gray-600" />
                    <span className="text-gray-500 text-xs font-mono">?</span>
                    <div className="w-4 h-px bg-gray-600" />
                  </div>
                ) : (
                  /* Normal connector with team badges */
                  <div className="flex flex-col items-center">
                    {teams.length > 0 && (
                      <div className="mb-1 -mt-4">
                        <TeamBadgeGroup teams={teams} />
                      </div>
                    )}
                    <div className="w-8 h-px bg-gradient-to-r from-white/20 via-white/40 to-white/20" />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Mobile: stacked link cards */
function MobileGraph({ forwardPath, backwardPath, teamLinks, complete }: ConnectionGraphProps) {
  const { players, gapAfterIndex } = buildChain(forwardPath, backwardPath, complete);

  // Build connection rows: each row is [player] -> [team] -> [next player]
  const connections: {
    from: PathPlayer;
    to: PathPlayer;
    teams: { name: string; imageUrl: string | null }[];
    fromVariant: 'start' | 'end' | 'intermediate';
    toVariant: 'start' | 'end' | 'intermediate';
    isGap: boolean;
  }[] = [];

  for (let i = 0; i < players.length - 1; i++) {
    const isGap = gapAfterIndex !== null && i === gapAfterIndex;
    const teams = isGap ? [] : findTeams(teamLinks, players[i].id, players[i + 1].id);
    connections.push({
      from: players[i],
      to: players[i + 1],
      teams,
      fromVariant: getVariant(i, players.length, !!complete),
      toVariant: getVariant(i + 1, players.length, !!complete),
      isGap,
    });
  }

  // If only one player, just show it
  if (players.length === 1) {
    return (
      <div className="md:hidden flex justify-center py-4">
        <PlayerNode
          name={players[0].name}
          imageUrl={players[0].imageUrl}
          nationality={players[0].nationality}
          variant="start"
          size="md"
        />
      </div>
    );
  }

  return (
    <div className="md:hidden flex flex-col gap-2 py-4">
      {connections.map((conn, i) => (
        <div
          key={`conn-${i}`}
          className="flex items-center gap-3 bg-surface/60 border border-border rounded-xl px-3 py-2.5"
        >
          <PlayerNode
            name={conn.from.name}
            imageUrl={conn.from.imageUrl}
            nationality={conn.from.nationality}
            variant={conn.fromVariant}
            size="sm"
          />

          <div className="flex-1 flex items-center justify-center min-w-0">
            {conn.isGap ? (
              <span className="text-gray-500 text-xs font-mono">???</span>
            ) : conn.teams.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600 text-xs">via</span>
                <TeamBadgeGroup teams={conn.teams} />
              </div>
            ) : (
              <div className="w-6 h-px bg-gray-700" />
            )}
          </div>

          <PlayerNode
            name={conn.to.name}
            imageUrl={conn.to.imageUrl}
            nationality={conn.to.nationality}
            variant={conn.toVariant}
            size="sm"
          />
        </div>
      ))}
    </div>
  );
}

export function ConnectionGraph(props: ConnectionGraphProps) {
  return (
    <>
      <DesktopGraph {...props} />
      <MobileGraph {...props} />
    </>
  );
}
