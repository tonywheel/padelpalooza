import { useState, useEffect } from 'react';
import { useTournamentStore } from './store/useTournamentStore';
import SetupScreen from './components/SetupScreen';
import BracketView from './components/BracketView';
import CourtSchedule from './components/CourtSchedule';
import TabBar from './components/TabBar';
import WinnerModal from './components/WinnerModal';
import GoLiveModal from './components/GoLiveModal';
import SpectatorView from './components/SpectatorView';
import type { Match } from './types/tournament';
import { isFirebaseConfigured } from './firebase';

// ─── Minimal path router (no external library needed) ────────────────────────

function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  return path;
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function App() {
  const path = usePath();

  // /v/:slug  →  read-only spectator view
  const spectatorMatch = path.match(/^\/v\/([a-z0-9][a-z0-9-]*)$/);
  if (spectatorMatch) {
    return <SpectatorView slug={spectatorMatch[1]} />;
  }

  return <AdminApp />;
}

// ─── Admin app (local + editable) ────────────────────────────────────────────

function AdminApp() {
  const {
    phase, activeTab, setActiveTab, resetApp,
    tournament, isLive, liveSlug,
  } = useTournamentStore();

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showGoLive, setShowGoLive] = useState(false);

  if (phase === 'setup') return <SetupScreen />;

  const champion =
    phase === 'complete'
      ? (tournament?.matches.find((m) => m.id === 'gf_reset' && m.status === 'completed')?.winner ??
         tournament?.matches.find((m) => m.id === 'gf')?.winner)
      : null;

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: '100dvh' }}>
      {/* Top bar */}
      <div className="bg-green-700 text-white px-4 pt-10 pb-3 flex items-center gap-3 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-none truncate">
            🎾 {tournament ? (useTournamentStore.getState().tournamentName || 'Padelpalooza') : 'Padelpalooza'}
          </h1>
          {tournament && (
            <p className="text-green-200 text-xs mt-0.5">
              {tournament.numTeams} teams · {tournament.matchDurationMinutes} min/match ·{' '}
              {tournament.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Go Live / Live badge */}
          {isFirebaseConfigured && (
            isLive ? (
              <button
                onClick={() => setShowGoLive(true)}
                className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full"
              >
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block" />
                Live · /v/{liveSlug}
              </button>
            ) : (
              <button
                onClick={() => setShowGoLive(true)}
                className="text-xs text-green-300 bg-green-800 px-2 py-1 rounded-lg"
              >
                📡 Share Live
              </button>
            )
          )}
          <button onClick={resetApp} className="text-xs text-green-300 bg-green-800 px-2 py-1 rounded-lg">
            Reset
          </button>
        </div>
      </div>

      {champion && (
        <div className="bg-yellow-400 text-yellow-900 text-center py-2 font-bold text-sm shrink-0">
          🏆 Champion: {champion.name}!
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col pb-16">
        {activeTab === 'bracket' ? (
          <BracketView onMatchTap={setSelectedMatch} />
        ) : (
          <CourtSchedule />
        )}
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {selectedMatch && (
        <WinnerModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}

      {showGoLive && (
        <GoLiveModal onClose={() => setShowGoLive(false)} />
      )}
    </div>
  );
}
