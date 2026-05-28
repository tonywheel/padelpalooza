
import type { Match } from '../types/tournament';
import { CARD_W, CARD_H } from '../utils/bracketGenerator';

interface Props {
  match: Match;
  onTap: (match: Match) => void;
  startTime: Date;
}

function minutesToClock(startTime: Date, offset: number): string {
  const d = new Date(startTime.getTime() + offset * 60_000);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function MatchCard({ match, onTap, startTime }: Props) {
  const { slot1, slot2, winner, status } = match;
  const isCompleted = status === 'completed';
  const isReady = status === 'ready';
  const isPending = status === 'pending';

  const teamRow = (
    slotTeam: typeof slot1,
    isWinner: boolean,
    isLoser: boolean,
  ) => {
    const name = slotTeam.team?.name ?? 'TBD';
    return (
      <div
        className={`flex items-center gap-1.5 px-2 h-[26px] ${
          isWinner
            ? 'bg-green-500 text-white rounded-t-[6px]'
            : isLoser
            ? 'text-gray-400 line-through'
            : slotTeam.team
            ? 'text-gray-800'
            : 'text-gray-400 italic'
        }`}
      >
        {isWinner && <span className="text-yellow-300 text-xs">★</span>}
        <span className="text-[11px] font-semibold truncate leading-none">{name}</span>
      </div>
    );
  };

  const borderColor =
    match.section === 'winners'
      ? 'border-green-400'
      : match.section === 'losers'
      ? 'border-orange-400'
      : 'border-yellow-500';

  const bgColor =
    isCompleted
      ? 'bg-gray-50'
      : isPending
      ? 'bg-gray-100'
      : 'bg-white';

  return (
    <button
      onClick={() => !isPending && onTap(match)}
      disabled={isPending || isCompleted}
      style={{ width: CARD_W, height: CARD_H, left: match.visualX, top: match.visualY }}
      className={`absolute rounded-lg border-2 ${borderColor} ${bgColor} overflow-hidden shadow-sm flex flex-col justify-between
        ${isReady ? 'active:scale-95 cursor-pointer' : 'cursor-default'}
        transition-transform`}
    >
      {/* Top team */}
      {teamRow(
        slot1,
        !!(winner && winner.id === slot1.team?.id),
        !!(winner && winner.id !== slot1.team?.id && slot1.team),
      )}

      {/* Divider with match info */}
      <div className={`flex items-center justify-between px-2 py-0 border-t border-b ${borderColor} bg-gray-50`}
        style={{ height: 8 }}>
      </div>

      {/* Bottom team */}
      {teamRow(
        slot2,
        !!(winner && winner.id === slot2.team?.id),
        !!(winner && winner.id !== slot2.team?.id && slot2.team),
      )}

      {/* Time & court badge */}
      <div className="absolute top-0 right-0 translate-x-0 translate-y-0">
        {match.startMinute > 0 || match.endMinute > 0 ? (
          <div className={`text-[8px] font-bold px-1 py-0.5 rounded-bl-md rounded-tr-[5px]
            ${match.courtNumber === 1 ? 'bg-blue-500 text-white' : 'bg-purple-500 text-white'}`}>
            C{match.courtNumber} · {minutesToClock(startTime, match.startMinute)}
          </div>
        ) : null}
      </div>

      {/* Status indicator */}
      {isReady && !isCompleted && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-400 rounded-b" />
      )}
    </button>
  );
}

/** Thin bracket connector line drawn as SVG elements */
export interface ConnectorProps {
  fromX: number; // right edge x of source match
  fromY: number; // center y of source match
  toX: number;   // left edge x of dest match
  toY: number;   // center y of dest match
  color?: string;
}

export function Connector({ fromX, fromY, toX, toY, color = '#d1d5db' }: ConnectorProps) {
  const midX = Math.round((fromX + toX) / 2);
  const d = `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
  return <path d={d} stroke={color} strokeWidth={1.5} fill="none" />;
}
