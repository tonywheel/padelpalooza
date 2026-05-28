import { useState } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';

export default function SetupScreen() {
  const {
    teamNames, startTimeStr, tournamentName,
    setTeamNames, setStartTime, setTournamentName, startTournament,
  } = useTournamentStore();
  const [numTeams, setNumTeams] = useState(teamNames.filter((n) => n.trim()).length || 8);

  const handleNumChange = (n: number) => {
    setNumTeams(n);
    setTeamNames(Array(n).fill('').map((_, i) => teamNames[i] ?? ''));
  };

  const handleNameChange = (i: number, val: string) => {
    const next = [...teamNames];
    next[i] = val;
    setTeamNames(next);
  };

  const canStart = teamNames.slice(0, numTeams).every((n) => n.trim() !== '');

  return (
    <div className="h-full bg-green-50 flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Header */}
      <div className="bg-green-700 text-white px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold">🎾 Padelpalooza</h1>
        <p className="text-green-200 text-sm mt-1">Double-Elimination Bracket</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-24">
        {/* Team count */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Number of Teams
          </h2>
          <div className="flex gap-2">
            {[8, 9, 10].map((n) => (
              <button
                key={n}
                onClick={() => handleNumChange(n)}
                className={`flex-1 py-3 rounded-xl text-lg font-bold transition-colors ${
                  numTeams === n
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {numTeams > 8 && (
            <p className="text-xs text-green-700 mt-2 bg-green-50 rounded-lg px-3 py-2">
              {numTeams === 9
                ? '1 play-in match · 7 byes into WB Round 1'
                : '2 play-in matches · 6 byes into WB Round 1'}
            </p>
          )}
        </section>

        {/* Tournament name */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Tournament Name <span className="text-gray-300 font-normal normal-case">(optional)</span>
          </h2>
          <input
            type="text"
            placeholder="e.g. Padel Palooza"
            value={tournamentName}
            onChange={(e) => setTournamentName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-1.5">Used for the live share link, e.g. /v/padel-palooza</p>
        </section>

        {/* Start time */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Tournament Start Time
          </h2>
          <input
            type="time"
            value={startTimeStr}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <p className="text-xs text-gray-400 mt-2">
            2 courts · {numTeams <= 8 ? '15' : numTeams === 9 ? '12' : '11'} min/match ·
            Court 2 free by {formatFreeTime(startTimeStr, numTeams)}
          </p>
        </section>

        {/* Team names */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Team Names
          </h2>
          <div className="space-y-2">
            {Array.from({ length: numTeams }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-green-100 text-green-700 text-sm font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <input
                  type="text"
                  placeholder={`Team ${i + 1}`}
                  value={teamNames[i] ?? ''}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Start button */}
      <div className="fixed bottom-0 inset-x-0 p-4 bg-white border-t border-gray-100">
        <button
          onClick={startTournament}
          disabled={!canStart}
          className={`w-full py-4 rounded-2xl text-lg font-bold transition-all ${
            canStart
              ? 'bg-green-600 text-white shadow-lg active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Generate Bracket →
        </button>
      </div>
    </div>
  );
}

function formatFreeTime(startTimeStr: string, numTeams: number): string {
  const [hStr, mStr] = startTimeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  // Court 2 free minute: 8→90, 9→84, 10→88
  const freeMinute = numTeams <= 8 ? 90 : numTeams === 9 ? 84 : 88;
  const totalMin = h * 60 + m + freeMinute;
  const fh = Math.floor(totalMin / 60) % 12 || 12;
  const fm = totalMin % 60;
  const ampm = Math.floor(totalMin / 60) >= 12 ? 'PM' : 'AM';
  return `${fh}:${String(fm).padStart(2, '0')} ${ampm}`;
}
