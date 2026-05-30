import { useTournamentStore } from '../store/useTournamentStore';
import {
  getSlotLabel,
  getSwappableSlots,
  getTbdSlots,
  isSeedingLocked,
  type SeedSlotRef,
} from '../utils/seedEditing';
import type { Match } from '../types/tournament';

function slotKey(ref: SeedSlotRef): string {
  return `${ref.matchId}:${ref.slot}`;
}

function isSelected(ref: SeedSlotRef, selected: SeedSlotRef | null): boolean {
  return selected?.matchId === ref.matchId && selected?.slot === ref.slot;
}

export default function SeedingEditor() {
  const {
    tournament,
    isLive,
    selectedSeedSlot,
    tapSeedSlot,
    clearSeedSelection,
  } = useTournamentStore();

  if (!tournament) return null;

  const locked = isSeedingLocked(tournament, isLive);
  const swappable = getSwappableSlots(tournament.matches);
  const tbdSlots = getTbdSlots(tournament.matches);

  const playInRefs = swappable.filter((r) => {
    const m = tournament.matches.find((x) => x.id === r.matchId)!;
    return m.round === -1;
  });

  const wbr1Refs = swappable.filter((r) => {
    const m = tournament.matches.find((x) => x.id === r.matchId)!;
    return m.round === 0;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
        <p className="text-sm text-blue-800 font-medium">
          {locked
            ? 'Seeding is locked — tournament is live or has results.'
            : 'Tap one team, then another to swap positions.'}
        </p>
        {!locked && (
          <p className="text-xs text-blue-600 mt-1">
            Move teams between Play-In and WB Round 1 to give byes to late arrivals.
            Locked after Share Live.
          </p>
        )}
        {selectedSeedSlot && !locked && (
          <button
            onClick={clearSeedSelection}
            className="mt-2 text-xs font-semibold text-blue-700 underline"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="px-4 py-4 space-y-5 pb-6">
        {playInRefs.length > 0 && (
          <Section title="Play-In" refs={playInRefs} matches={tournament.matches} selected={selectedSeedSlot} locked={locked} onTap={tapSeedSlot} />
        )}

        <Section title="Winners Bracket · Round 1" refs={wbr1Refs} matches={tournament.matches} selected={selectedSeedSlot} locked={locked} onTap={tapSeedSlot} />

        {tbdSlots.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
              Waiting on Play-In (not editable)
            </h3>
            <div className="space-y-2">
              {tbdSlots.map(({ match, slot }) => (
                <div
                  key={`${match.id}-${slot}`}
                  className="flex items-center gap-3 bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 opacity-70"
                >
                  <span className="text-sm text-gray-400 italic flex-1">TBD</span>
                  <span className="text-xs text-gray-400">{getSlotLabel(match, slot)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  refs,
  matches,
  selected,
  locked,
  onTap,
}: {
  title: string;
  refs: SeedSlotRef[];
  matches: Match[];
  selected: SeedSlotRef | null;
  locked: boolean;
  onTap: (ref: SeedSlotRef) => void;
}) {
  if (refs.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-2">
        {refs.map((ref) => {
          const match = matches.find((m) => m.id === ref.matchId)!;
          const team = ref.slot === 1 ? match.slot1.team : match.slot2.team;
          const selectedRow = isSelected(ref, selected);

          return (
            <button
              key={slotKey(ref)}
              onClick={() => !locked && onTap(ref)}
              disabled={locked}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 min-h-[52px] text-left transition-all ${
                locked
                  ? 'bg-gray-100 border border-gray-200 opacity-60 cursor-default'
                  : selectedRow
                  ? 'bg-blue-100 border-2 border-blue-500 shadow-sm'
                  : 'bg-white border border-gray-200 active:scale-[0.98]'
              }`}
            >
              <span className="text-sm font-semibold text-gray-900 flex-1 truncate">
                {team?.name ?? '—'}
              </span>
              <span className="text-[10px] text-gray-400 font-medium shrink-0">
                {getSlotLabel(match, ref.slot)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
