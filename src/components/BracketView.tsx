import React, { useMemo } from 'react';
import type { Match } from '../types/tournament';
import { CARD_W, CARD_H, getCanvasDimensions } from '../utils/bracketGenerator';
import MatchCard, { Connector } from './MatchCard';
import { useTournamentStore } from '../store/useTournamentStore';

interface Props {
  onMatchTap: (match: Match) => void;
  seedingEnabled?: boolean;
}

export default function BracketView({ onMatchTap, seedingEnabled = false }: Props) {
  const { tournament, selectedSeedSlot } = useTournamentStore();
  if (!tournament) return null;

  const { matches, startTime, matchDurationMinutes, numTeams } = tournament;
  const visibleMatches = matches.filter(
    (m) => !m.isResetMatch || m.resetActive,
  );

  const dims = useMemo(() => getCanvasDimensions(visibleMatches), [visibleMatches]);

  // Build connectors: for each match with a winnerTo/loserTo, draw a line
  const connectors = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const byId = new Map(matches.map((m) => [m.id, m]));

    for (const src of visibleMatches) {
      const fromX = src.visualX + CARD_W;
      const fromCY = src.visualY + CARD_H / 2;

      if (src.winnerTo) {
        const dest = byId.get(src.winnerTo.matchId);
        if (dest && (!dest.isResetMatch || dest.resetActive)) {
          const toX = dest.visualX;
          const destSlotY =
            src.winnerTo.slot === 1
              ? dest.visualY + CARD_H * 0.25
              : dest.visualY + CARD_H * 0.75;
          lines.push(
            <Connector
              key={`w-${src.id}-${dest.id}`}
              fromX={fromX}
              fromY={fromCY}
              toX={toX}
              toY={destSlotY}
              color="#86efac" // green-300
            />,
          );
        }
      }

      if (src.loserTo) {
        const dest = byId.get(src.loserTo.matchId);
        if (dest && (!dest.isResetMatch || dest.resetActive)) {
          const toX = dest.visualX;
          const destSlotY =
            src.loserTo.slot === 1
              ? dest.visualY + CARD_H * 0.25
              : dest.visualY + CARD_H * 0.75;
          lines.push(
            <Connector
              key={`l-${src.id}-${dest.id}`}
              fromX={fromX}
              fromY={fromCY}
              toX={toX}
              toY={destSlotY}
              color="#fdba74" // orange-300
            />,
          );
        }
      }
    }
    return lines;
  }, [visibleMatches, matches]);

  const wbMatches = visibleMatches.filter((m) => m.section === 'winners');
  const lbMatches = visibleMatches.filter((m) => m.section === 'losers');
  const gfMatches = visibleMatches.filter((m) => m.section === 'grand_final');

  return (
    <div className="flex-1 overflow-hidden bg-gray-50">
      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> WB</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> LB</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> GF</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> C1</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> C2</span>
        <span className="ml-auto flex items-center gap-2">
          {seedingEnabled && (
            <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Seeding editable</span>
          )}
          <span className="font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
            {numTeams} teams · {matchDurationMinutes} min
          </span>
        </span>
      </div>

      {/* Section labels */}
      <div className="overflow-x-auto overflow-y-auto flex-1" style={{ maxHeight: 'calc(100dvh - 140px)' }}>
        <div
          className="relative"
          style={{ width: dims.width, height: dims.height + 60 }}
        >
          {/* Section labels */}
          <SectionLabel text="Winners Bracket" color="text-green-700" x={wbMatches[0]?.visualX ?? 0} />
          {lbMatches.length > 0 && (
            <SectionLabel
              text="Losers Bracket"
              color="text-orange-700"
              x={lbMatches[0]?.visualX ?? 0}
              y={lbMatches[0]?.visualY ? lbMatches[0].visualY - 22 : 0}
            />
          )}
          {gfMatches.length > 0 && (
            <SectionLabel
              text="Grand Final"
              color="text-yellow-700"
              x={gfMatches[0]?.visualX ?? 0}
              y={8}
            />
          )}

          {/* SVG connectors */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={dims.width}
            height={dims.height + 60}
          >
            {connectors}
          </svg>

          {/* Match cards */}
          {visibleMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              onTap={onMatchTap}
              startTime={startTime}
              seedingEnabled={seedingEnabled}
              selectedSeedSlot={selectedSeedSlot}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({
  text,
  color,
  x,
  y = 8,
}: {
  text: string;
  color: string;
  x: number;
  y?: number;
}) {
  return (
    <div
      className={`absolute text-[10px] font-bold uppercase tracking-widest ${color} pointer-events-none`}
      style={{ left: x, top: y }}
    >
      {text}
    </div>
  );
}
