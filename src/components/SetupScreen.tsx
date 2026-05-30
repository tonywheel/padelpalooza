import { useTournamentStore } from '../store/useTournamentStore';
import type { SetupMode } from '../store/useTournamentStore';

export default function SetupScreen() {
  const {
    setupMode,
    setupNumTeams,
    teamNames,
    boyNames,
    girlNames,
    pairedTeamNames,
    startTimeStr,
    tournamentName,
    setSetupMode,
    setSetupNumTeams,
    setTeamNames,
    setBoyNames,
    setGirlNames,
    generatePlayerTeams,
    setStartTime,
    setTournamentName,
    startTournament,
  } = useTournamentStore();

  const numTeams = setupNumTeams;
  const numPlayers = numTeams * 2;

  const handleNumChange = (n: number) => setSetupNumTeams(n);

  const handleModeChange = (mode: SetupMode) => setSetupMode(mode);

  const handleTeamNameChange = (i: number, val: string) => {
    const next = [...teamNames];
    next[i] = val;
    setTeamNames(next);
  };

  const handleBoyChange = (i: number, val: string) => {
    const next = [...boyNames];
    next[i] = val;
    setBoyNames(next);
  };

  const handleGirlChange = (i: number, val: string) => {
    const next = [...girlNames];
    next[i] = val;
    setGirlNames(next);
  };

  const filledBoys = boyNames.map((n) => n.trim()).filter(Boolean);
  const filledGirls = girlNames.map((n) => n.trim()).filter(Boolean);
  const filledPlayers = [...filledBoys, ...filledGirls];
  const playerNamesUnique =
    new Set(filledPlayers.map((p) => p.toLowerCase())).size === filledPlayers.length;
  const allPlayersFilled = filledPlayers.length === numPlayers;
  const canGenerateTeams = allPlayersFilled && playerNamesUnique;

  const canStartTeams =
    setupMode === 'teams' &&
    teamNames.slice(0, numTeams).every((n) => n.trim() !== '');

  const canStartPlayers =
    setupMode === 'players' &&
    pairedTeamNames != null &&
    pairedTeamNames.length === numTeams;

  const canStart = canStartTeams || canStartPlayers;

  // Show enough rows per column (expand as user fills names)
  const boyRows = Math.min(numPlayers, Math.max(numTeams, filledBoys.length + 1));
  const girlRows = Math.min(numPlayers, Math.max(numTeams, filledGirls.length + 1));

  return (
    <div className="h-full bg-green-50 flex flex-col" style={{ minHeight: '100dvh' }}>
      <div className="bg-green-700 text-white px-4 pt-12 pb-6">
        <h1 className="text-2xl font-bold">🎾 Padelpalooza</h1>
        <p className="text-green-200 text-sm mt-1">Double-Elimination Bracket</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-32">
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

        <section className="bg-white rounded-2xl shadow-sm p-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            How to enter teams
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleModeChange('teams')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                setupMode === 'teams'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Team names
            </button>
            <button
              onClick={() => handleModeChange('players')}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${
                setupMode === 'players'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Player names
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {setupMode === 'teams'
              ? 'Enter each team name directly.'
              : `Enter ${numPlayers} players in the Boys / Girls columns — we pair boy/girl teams when possible.`}
          </p>
        </section>

        {setupMode === 'teams' ? (
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
                    onChange={(e) => handleTeamNameChange(i, e.target.value)}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Players ({filledBoys.length + filledGirls.length}/{numPlayers})
                </h2>
                <span className="text-xs text-gray-400">
                  {filledBoys.length} boys · {filledGirls.length} girls
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Boys column */}
                <div>
                  <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 text-center bg-blue-50 rounded-lg py-1">
                    Boys
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {Array.from({ length: boyRows }, (_, i) => (
                      <input
                        key={`b-${i}`}
                        type="text"
                        placeholder={`Boy ${i + 1}`}
                        value={boyNames[i] ?? ''}
                        onChange={(e) => handleBoyChange(i, e.target.value)}
                        className="w-full border border-blue-100 bg-blue-50/50 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    ))}
                  </div>
                </div>

                {/* Girls column */}
                <div>
                  <div className="text-xs font-bold text-pink-700 uppercase tracking-wide mb-2 text-center bg-pink-50 rounded-lg py-1">
                    Girls
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {Array.from({ length: girlRows }, (_, i) => (
                      <input
                        key={`g-${i}`}
                        type="text"
                        placeholder={`Girl ${i + 1}`}
                        value={girlNames[i] ?? ''}
                        onChange={(e) => handleGirlChange(i, e.target.value)}
                        className="w-full border border-pink-100 bg-pink-50/50 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {!playerNamesUnique && filledPlayers.length > 0 && (
                <p className="text-xs text-red-500 mt-2">Each player name must be unique.</p>
              )}
              {filledPlayers.length > 0 && filledPlayers.length !== numPlayers && (
                <p className="text-xs text-amber-600 mt-2">
                  Need exactly {numPlayers} players total ({numPlayers - filledPlayers.length} more).
                </p>
              )}
            </section>

            <section className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Generated Teams
                </h2>
                <button
                  onClick={generatePlayerTeams}
                  disabled={!canGenerateTeams}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors ${
                    canGenerateTeams
                      ? 'bg-blue-600 text-white active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {pairedTeamNames ? '🔀 Shuffle Again' : '🎲 Generate Teams'}
                </button>
              </div>

              {pairedTeamNames ? (
                <div className="space-y-2">
                  {pairedTeamNames.map((name, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5"
                    >
                      <span className="w-7 h-7 rounded-full bg-green-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">{name}</span>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 mt-2">
                    Boy/girl pairs when possible. Tap <strong>Shuffle Again</strong> for new pairings.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">
                  Fill in all {numPlayers} players, then tap <strong>Generate Teams</strong>.
                </p>
              )}
            </section>
          </>
        )}
      </div>

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
        {setupMode === 'players' && !canStartPlayers && (
          <p className="text-xs text-center text-gray-400 mt-2">
            Generate teams first, then create the bracket.
          </p>
        )}
      </div>
    </div>
  );
}

function formatFreeTime(startTimeStr: string, numTeams: number): string {
  const [hStr, mStr] = startTimeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const freeMinute = numTeams <= 8 ? 90 : numTeams === 9 ? 84 : 88;
  const totalMin = h * 60 + m + freeMinute;
  const fh = Math.floor(totalMin / 60) % 12 || 12;
  const fm = totalMin % 60;
  const ampm = Math.floor(totalMin / 60) >= 12 ? 'PM' : 'AM';
  return `${fh}:${String(fm).padStart(2, '0')} ${ampm}`;
}
