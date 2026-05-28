import { useEffect, useState, useMemo } from 'react';
import type { Tournament } from '../types/tournament';
import { subscribeTournament } from '../utils/firebaseSync';
import { isFirebaseConfigured } from '../firebase';
import { getCanvasDimensions, CARD_W, CARD_H } from '../utils/bracketGenerator';
import MatchCard, { Connector } from './MatchCard';

interface Props {
  slug: string;
}

export default function SpectatorView({ slug }: Props) {
  const [name, setName] = useState<string>('');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [status, setStatus] = useState<'loading' | 'live' | 'notfound' | 'unconfigured'>('loading');
  const [activeTab, setActiveTab] = useState<'bracket' | 'schedule'>('bracket');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setStatus('unconfigured');
      return;
    }

    setStatus('loading');
    const unsub = subscribeTournament(slug, (data) => {
      if (!data) {
        setStatus('notfound');
        return;
      }
      setName(data.name);
      setTournament(data.tournament);
      setLastUpdated(new Date());
      setStatus('live');
    });
    return unsub;
  }, [slug]);

  if (status === 'unconfigured') {
    return <FullPageMessage icon="🔧" title="Firebase not configured" subtitle="The app host hasn't set up live sharing yet." />;
  }
  if (status === 'loading') {
    return <FullPageMessage icon="⏳" title="Loading tournament…" subtitle={`Looking for "${slug}"`} pulse />;
  }
  if (status === 'notfound' || !tournament) {
    return (
      <FullPageMessage
        icon="🎾"
        title="Bracket not found"
        subtitle={`No live tournament at "/v/${slug}". Check the link and try again.`}
      />
    );
  }

  const champion =
    tournament.matches.find((m) => m.id === 'gf_reset' && m.status === 'completed')?.winner ??
    tournament.matches.find((m) => m.id === 'gf' && m.status === 'completed')?.winner;

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="bg-green-700 text-white px-4 pt-10 pb-3 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold leading-none">{name || slug}</span>
              <LiveBadge />
            </div>
            <p className="text-green-200 text-xs mt-0.5">
              {tournament.numTeams} teams · {tournament.matchDurationMinutes} min/match ·{' '}
              {tournament.startTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-green-300">👁 View only</p>
            {lastUpdated && (
              <p className="text-[9px] text-green-400">
                Updated {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="bg-yellow-400 text-yellow-900 text-center py-2 font-bold text-sm shrink-0">
          🏆 Champion: {champion.name}!
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100 shrink-0">
        {(['bracket', 'schedule'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'text-green-700 border-b-2 border-green-600'
                : 'text-gray-400'
            }`}
          >
            {tab === 'bracket' ? '🏆 Bracket' : '📅 Schedule'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'bracket' ? (
          <SpectatorBracket tournament={tournament} />
        ) : (
          <SpectatorSchedule tournament={tournament} />
        )}
      </div>
    </div>
  );
}

// ─── Read-only bracket ────────────────────────────────────────────────────────

function SpectatorBracket({ tournament }: { tournament: Tournament }) {
  const { matches, startTime } = tournament;
  const visibleMatches = matches.filter((m) => !m.isResetMatch || m.resetActive);
  const dims = useMemo(() => getCanvasDimensions(visibleMatches), [visibleMatches]);

  const connectors = useMemo(() => {
    const lines: React.ReactNode[] = [];
    const byId = new Map(matches.map((m) => [m.id, m]));
    for (const src of visibleMatches) {
      const fromX = src.visualX + CARD_W;
      const fromCY = src.visualY + CARD_H / 2;
      if (src.winnerTo) {
        const dest = byId.get(src.winnerTo.matchId);
        if (dest && (!dest.isResetMatch || dest.resetActive)) {
          const toY = src.winnerTo.slot === 1
            ? dest.visualY + CARD_H * 0.25
            : dest.visualY + CARD_H * 0.75;
          lines.push(
            <Connector key={`w-${src.id}`} fromX={fromX} fromY={fromCY} toX={dest.visualX} toY={toY} color="#86efac" />
          );
        }
      }
      if (src.loserTo) {
        const dest = byId.get(src.loserTo.matchId);
        if (dest && (!dest.isResetMatch || dest.resetActive)) {
          const toY = src.loserTo.slot === 1
            ? dest.visualY + CARD_H * 0.25
            : dest.visualY + CARD_H * 0.75;
          lines.push(
            <Connector key={`l-${src.id}`} fromX={fromX} fromY={fromCY} toX={dest.visualX} toY={toY} color="#fdba74" />
          );
        }
      }
    }
    return lines;
  }, [visibleMatches, matches]);

  return (
    <div className="flex-1 overflow-hidden bg-gray-50">
      <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-400 inline-block" /> WB</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> LB</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> GF</span>
        <span className="ml-auto text-gray-400">← scroll →</span>
      </div>
      <div className="overflow-x-auto overflow-y-auto flex-1" style={{ maxHeight: 'calc(100dvh - 180px)' }}>
        <div className="relative" style={{ width: dims.width, height: dims.height + 60 }}>
          <svg className="absolute inset-0 pointer-events-none" width={dims.width} height={dims.height + 60}>
            {connectors}
          </svg>
          {visibleMatches.map((match) => (
            // Read-only: pass a no-op onTap
            <MatchCard
              key={match.id}
              match={match}
              onTap={() => {}}
              startTime={startTime}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Read-only schedule ───────────────────────────────────────────────────────

function SpectatorSchedule({ tournament }: { tournament: Tournament }) {
  const { matches, startTime, matchDurationMinutes, numTeams } = tournament;
  const scheduled = matches
    .filter((m) => !m.isResetMatch && m.startMinute !== undefined)
    .sort((a, b) => a.startMinute - b.startMinute || a.courtNumber - b.courtNumber);

  const freeMinute = numTeams <= 8 ? 90 : numTeams === 9 ? 84 : 88;

  function clock(offset: number) {
    const d = new Date(startTime.getTime() + offset * 60_000);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3 pb-6">
      <div className="bg-white rounded-xl px-4 py-3 mb-3 text-sm flex justify-between items-center">
        <span className="font-bold">{clock(0)} → {clock(120)}</span>
        <span className="text-gray-400 text-xs">{matchDurationMinutes} min/match</span>
      </div>
      <div className="space-y-1.5">
        {scheduled.map((match) => {
          const isC1 = match.courtNumber === 1;
          const statusCls =
            match.status === 'completed' ? 'bg-green-100 text-green-700' :
            match.status === 'ready' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-500';
          const statusLabel =
            match.status === 'completed' ? 'Done' :
            match.status === 'ready' ? 'Next' : 'Pending';
          return (
            <div
              key={match.id}
              className={`bg-white rounded-xl px-3 py-2.5 flex items-center gap-3 shadow-sm border ${isC1 ? 'border-blue-100' : 'border-purple-100'}`}
            >
              <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isC1 ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                C{match.courtNumber}
              </div>
              <div className="text-xs font-mono text-gray-500 w-16 shrink-0">
                {clock(match.startMinute)}<span className="text-gray-300">–</span>{clock(match.endMinute)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide leading-none mb-0.5">{match.label}</div>
                <div className="text-xs font-medium text-gray-800 truncate">
                  {match.slot1.team?.name ?? 'TBD'} <span className="text-gray-300">vs</span> {match.slot2.team?.name ?? 'TBD'}
                  {match.winner && <span className="ml-1 text-green-600 font-bold">→ {match.winner.name}</span>}
                </div>
              </div>
              <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${statusCls}`}>
                {statusLabel}
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 px-3 py-2 text-xs text-purple-500">
          <span className="w-2 h-2 rounded-full bg-purple-400 inline-block shrink-0" />
          Court 2 free from {clock(freeMinute)}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function LiveBadge() {
  return (
    <span className="flex items-center gap-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
      <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse inline-block" />
      Live
    </span>
  );
}

function FullPageMessage({
  icon, title, subtitle, pulse,
}: {
  icon: string; title: string; subtitle: string; pulse?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-8 bg-gray-50 text-center">
      <div className={`text-5xl ${pulse ? 'animate-pulse' : ''}`}>{icon}</div>
      <h1 className="text-xl font-bold text-gray-800">{title}</h1>
      <p className="text-gray-500 text-sm max-w-xs">{subtitle}</p>
    </div>
  );
}
