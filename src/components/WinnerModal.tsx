
import type { Match } from '../types/tournament';
import { useTournamentStore } from '../store/useTournamentStore';

interface Props {
  match: Match;
  onClose: () => void;
}

function minutesToClock(startTime: Date, offset: number): string {
  const d = new Date(startTime.getTime() + offset * 60_000);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function WinnerModal({ match, onClose }: Props) {
  const { recordWinner, enableBracketReset, tournament } = useTournamentStore();
  if (!tournament) return null;

  const { slot1, slot2, status } = match;
  const team1 = slot1.team;
  const team2 = slot2.team;
  const isCompleted = status === 'completed';

  // Show bracket-reset option when GF is completed and LB champ won
  const showResetOption =
    match.id === 'gf' &&
    isCompleted &&
    match.winner !== null &&
    match.slot2.team?.id === match.winner.id && // LB finalist (slot2) won
    !tournament.matches.find((m) => m.isResetMatch)?.resetActive;

  const handleWinner = (winnerId: string) => {
    recordWinner(match.id, winnerId);
    onClose();
  };

  const handleReset = () => {
    enableBracketReset();
    onClose();
  };

  const sectionColor =
    match.section === 'winners'
      ? 'bg-green-600'
      : match.section === 'losers'
      ? 'bg-orange-500'
      : 'bg-yellow-500';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 pb-safe"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-lg px-5 pt-4 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {/* Title */}
        <div className={`${sectionColor} text-white text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full inline-block mb-3`}>
          {match.label}
        </div>

        {/* Court & time */}
        <div className="text-sm text-gray-500 mb-5">
          Court {match.courtNumber} ·{' '}
          {minutesToClock(tournament.startTime, match.startMinute)} –{' '}
          {minutesToClock(tournament.startTime, match.endMinute)}
        </div>

        {isCompleted ? (
          <>
            <div className="text-center py-4">
              <div className="text-4xl mb-2">🏆</div>
              <p className="text-gray-600 text-sm">
                <strong className="text-gray-900">{match.winner?.name}</strong> won this match
              </p>
            </div>
            {showResetOption && (
              <div className="mt-4 space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
                  <strong>{match.winner?.name}</strong> (Losers Bracket) won the Grand Final!
                  Since the Winners Bracket finalist has never lost, you can play a bracket reset.
                </div>
                <button
                  onClick={handleReset}
                  className="w-full py-3.5 bg-yellow-500 text-white font-bold rounded-2xl active:scale-95 transition-transform"
                >
                  🔄 Enable Bracket Reset
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3.5 bg-gray-100 text-gray-600 font-semibold rounded-2xl"
                >
                  No Reset — Tournament Over
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-4">Who won this match?</p>
            <div className="space-y-3">
              {[
                { team: team1, slot: 'slot1' as const },
                { team: team2, slot: 'slot2' as const },
              ].map(({ team }) =>
                team ? (
                  <button
                    key={team.id}
                    onClick={() => handleWinner(team.id)}
                    className="w-full py-4 bg-green-50 border-2 border-green-200 text-green-800 font-bold text-lg rounded-2xl active:bg-green-100 active:scale-95 transition-all"
                  >
                    {team.name}
                  </button>
                ) : null,
              )}
            </div>
            <button
              onClick={onClose}
              className="w-full mt-3 py-3.5 bg-gray-100 text-gray-500 font-medium rounded-2xl"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
