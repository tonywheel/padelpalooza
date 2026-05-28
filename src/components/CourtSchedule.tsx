
import { useTournamentStore } from '../store/useTournamentStore';
import type { Match } from '../types/tournament';

function minutesToClock(startTime: Date, offset: number): string {
  const d = new Date(startTime.getTime() + offset * 60_000);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function statusBadge(match: Match) {
  if (match.status === 'completed') return { label: 'Done', cls: 'bg-green-100 text-green-700' };
  if (match.status === 'ready') return { label: 'Up Next', cls: 'bg-blue-100 text-blue-700' };
  return { label: 'Pending', cls: 'bg-gray-100 text-gray-500' };
}

function teamName(match: Match, slot: 'slot1' | 'slot2'): string {
  return match[slot].team?.name ?? 'TBD';
}

export default function CourtSchedule() {
  const { tournament } = useTournamentStore();
  if (!tournament) return null;

  const { matches, startTime, matchDurationMinutes, numTeams } = tournament;

  // Only include scheduled, non-reset matches
  const scheduled = matches
    .filter((m) => !m.isResetMatch && m.startMinute !== undefined)
    .sort((a, b) => a.startMinute - b.startMinute || a.courtNumber - b.courtNumber);

  const court1 = scheduled.filter((m) => m.courtNumber === 1);
  const court2 = scheduled.filter((m) => m.courtNumber === 2);

  const freeMinute = numTeams <= 8 ? 90 : numTeams === 9 ? 84 : 88;
  const freeTime = minutesToClock(startTime, freeMinute);
  const endTime = minutesToClock(startTime, 120);

  // Build time-slot rows (sorted by start time)
  const slots = [...new Set(scheduled.map((m) => m.startMinute))].sort((a, b) => a - b);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header summary */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="font-bold text-gray-800">
              {minutesToClock(startTime, 0)}
            </span>
            <span className="text-gray-400 mx-1">→</span>
            <span className="font-bold text-gray-800">{endTime}</span>
          </div>
          <div className="text-xs text-gray-500 text-right">
            {matchDurationMinutes} min/match
            <span className="block text-green-600">Times update when you enter results</span>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1 text-xs text-purple-700">
          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
          Court 2 free from {freeTime} (30+ min before end)
        </div>
      </div>

      {/* Parallel view: Court 1 | Court 2 */}
      <div className="px-3 py-3 space-y-2">
        <div className="grid grid-cols-2 gap-2 mb-2 text-center text-xs font-bold">
          <div className="bg-blue-600 text-white rounded-xl py-1.5">Court 1</div>
          <div className="bg-purple-600 text-white rounded-xl py-1.5">Court 2</div>
        </div>

        {slots.map((slot) => {
          const c1 = court1.find((m) => m.startMinute === slot);
          const c2 = court2.find((m) => m.startMinute === slot);
          const timeLabel = minutesToClock(startTime, slot);
          return (
            <div key={slot} className="flex gap-2 items-stretch">
              <div className="w-16 shrink-0 flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-gray-500">{timeLabel}</span>
                {slot > 0 && (
                  <span className="text-[9px] text-gray-400">+{slot}m</span>
                )}
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <MatchSlot match={c1} courtColor="blue" />
                <MatchSlot match={c2} courtColor="purple" />
              </div>
            </div>
          );
        })}

        {/* Free court indicator */}
        <div className="flex gap-2 items-stretch mt-1">
          <div className="w-16 shrink-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-bold text-gray-500">{freeTime}</span>
            <span className="text-[9px] text-gray-400">+{freeMinute}m</span>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            <div />
            <div className="rounded-xl bg-purple-50 border border-purple-200 px-3 py-2 flex items-center justify-center">
              <span className="text-xs text-purple-500 font-medium">🆓 Free</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sequential list */}
      <div className="px-3 pb-6 mt-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">
          All Matches
        </h3>
        <div className="space-y-1.5">
          {scheduled.map((match) => {
            const badge = statusBadge(match);
            const isC1 = match.courtNumber === 1;
            return (
              <div
                key={match.id}
                className={`bg-white rounded-xl px-3 py-2.5 flex items-center gap-3 shadow-sm border ${
                  isC1 ? 'border-blue-100' : 'border-purple-100'
                }`}
              >
                {/* Court badge */}
                <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isC1 ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                }`}>
                  C{match.courtNumber}
                </div>

                {/* Time */}
                <div className="text-xs font-mono text-gray-500 w-16 shrink-0">
                  {minutesToClock(startTime, match.startMinute)}
                  <span className="text-gray-300"> – </span>
                  {minutesToClock(startTime, match.endMinute)}
                </div>

                {/* Match info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide leading-none mb-0.5">
                    {match.label}
                  </div>
                  <div className="text-xs font-medium text-gray-800 truncate">
                    {teamName(match, 'slot1')} <span className="text-gray-300">vs</span> {teamName(match, 'slot2')}
                  </div>
                </div>

                {/* Status */}
                <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                  {badge.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MatchSlot({ match, courtColor }: { match: Match | undefined; courtColor: 'blue' | 'purple' }) {
  if (!match) {
    return (
      <div className={`rounded-xl border-2 border-dashed ${
        courtColor === 'blue' ? 'border-blue-100' : 'border-purple-100'
      } flex items-center justify-center py-3`}>
        <span className="text-[9px] text-gray-300">—</span>
      </div>
    );
  }

  const badge = statusBadge(match);
  return (
    <div className={`rounded-xl border ${
      courtColor === 'blue' ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50'
    } px-2 py-2`}>
      <div className={`text-[8px] font-bold mb-1 ${badge.cls} rounded px-1 inline-block`}>
        {match.label}
      </div>
      <div className="text-[10px] font-semibold text-gray-700 leading-tight truncate">
        {match.slot1.team?.name ?? 'TBD'}
      </div>
      <div className="text-[9px] text-gray-400">vs</div>
      <div className="text-[10px] font-semibold text-gray-700 leading-tight truncate">
        {match.slot2.team?.name ?? 'TBD'}
      </div>
    </div>
  );
}
