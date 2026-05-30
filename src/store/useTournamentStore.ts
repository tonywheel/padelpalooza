import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActiveTab, AppPhase, Match, Team, Tournament } from '../types/tournament';
import { generateBracket, getMatchDuration } from '../utils/bracketGenerator';
import { scheduleCourts } from '../utils/courtScheduler';
import {
  getEarliestFinishMinute,
  isCourtQueueReady,
  recomputeSchedule,
} from '../utils/dynamicScheduler';
import { pushTournament } from '../utils/firebaseSync';
import { generateRandomTeams } from '../utils/playerPairing';

export type SetupMode = 'teams' | 'players';

interface TournamentStore {
  phase: AppPhase;
  setupMode: SetupMode;
  teamNames: string[];
  playerNames: string[];
  /** Team names from last player shuffle; null until first generate */
  pairedTeamNames: string[] | null;
  startTimeStr: string; // "HH:MM" 24-hour format
  tournamentName: string; // e.g. "Padel Palooza"
  tournament: Tournament | null;
  activeTab: ActiveTab;
  selectedMatchId: string | null;

  // Live-share state
  isLive: boolean;
  liveSlug: string | null; // e.g. "padel-palooza"

  // Setup actions
  setSetupMode: (mode: SetupMode) => void;
  setTeamNames: (names: string[]) => void;
  setPlayerNames: (names: string[]) => void;
  generatePlayerTeams: () => void;
  setStartTime: (time: string) => void;
  setTournamentName: (name: string) => void;
  startTournament: () => void;
  resetApp: () => void;

  // Tournament actions
  setActiveTab: (tab: ActiveTab) => void;
  selectMatch: (matchId: string | null) => void;
  recordWinner: (matchId: string, winnerId: string, completedAtMinute?: number) => void;
  enableBracketReset: () => void;

  // Live-share actions
  goLive: (slug: string) => Promise<void>;

  // Helpers
  getMatch: (id: string) => Match | undefined;
}

function parseStartTime(str: string): Date {
  const [hStr, mStr] = str.split(':');
  const now = new Date();
  now.setHours(parseInt(hStr, 10), parseInt(mStr, 10), 0, 0);
  return now;
}

export const useTournamentStore = create<TournamentStore>()(
  persist(
    (set, get) => ({
      phase: 'setup',
      setupMode: 'teams',
      teamNames: Array(8).fill(''),
      playerNames: Array(16).fill(''),
      pairedTeamNames: null,
      startTimeStr: '14:00',
      tournamentName: '',
      tournament: null,
      activeTab: 'bracket',
      selectedMatchId: null,
      isLive: false,
      liveSlug: null,

      setSetupMode: (mode) => set({ setupMode: mode, pairedTeamNames: null }),

      setTeamNames: (names) => set({ teamNames: names }),

      setPlayerNames: (names) => set({ playerNames: names, pairedTeamNames: null }),

      generatePlayerTeams: () => {
        const { playerNames } = get();
        const expected = playerNames.length;
        const filled = playerNames.map((n) => n.trim()).filter(Boolean);
        if (filled.length !== expected || expected % 2 !== 0) return;
        try {
          const teams = generateRandomTeams(filled);
          set({ pairedTeamNames: teams });
        } catch {
          // invalid input (duplicates, etc.)
        }
      },

      setStartTime: (time) => set({ startTimeStr: time }),
      setTournamentName: (name) => set({ tournamentName: name }),

      startTournament: () => {
        const { teamNames, setupMode, pairedTeamNames, startTimeStr } = get();

        const filledNames =
          setupMode === 'players'
            ? (pairedTeamNames ?? []).filter((n) => n.trim() !== '')
            : teamNames.filter((n) => n.trim() !== '');

        const n = filledNames.length;
        if (n < 8 || n > 10) return;

        const teams: Team[] = filledNames.map((name, i) => ({
          id: `team_${i}`,
          name: name.trim(),
          seed: i + 1,
        }));

        const duration = getMatchDuration(n);
        const startTime = parseStartTime(startTimeStr);

        let matches = generateBracket(teams);
        matches = scheduleCourts(matches, n, duration);

        const tournament: Tournament = {
          numTeams: n,
          teams,
          matches,
          matchDurationMinutes: duration,
          startTime,
        };

        set({ tournament, phase: 'tournament' });
      },

      resetApp: () =>
        set({
          phase: 'setup',
          setupMode: 'teams',
          tournament: null,
          selectedMatchId: null,
          activeTab: 'bracket',
          teamNames: Array(8).fill(''),
          playerNames: Array(16).fill(''),
          pairedTeamNames: null,
          isLive: false,
          liveSlug: null,
          tournamentName: '',
        }),

      setActiveTab: (tab) => set({ activeTab: tab }),

      selectMatch: (matchId) => set({ selectedMatchId: matchId }),

      recordWinner: (matchId, winnerId, completedAtMinuteOverride) => {
        const { tournament } = get();
        if (!tournament) return;

        const matches = tournament.matches.map((m) => ({ ...m }));
        const byId = new Map(matches.map((m) => [m.id, m]));

        const match = byId.get(matchId);
        if (!match || match.status === 'completed') return;

        const winner =
          match.slot1.team?.id === winnerId ? match.slot1.team : match.slot2.team;
        const loser =
          match.slot1.team?.id === winnerId ? match.slot2.team : match.slot1.team;

        if (!winner || !loser) return;
        if (!isCourtQueueReady(match, matches, tournament.numTeams)) return;

        const wallClockMinute = Math.round(
          (Date.now() - tournament.startTime.getTime()) / 60_000,
        );
        const completedAt = completedAtMinuteOverride ?? wallClockMinute;
        const earliest = getEarliestFinishMinute(match, matches, tournament.numTeams);
        match.completedAtMinute = Math.max(completedAt, earliest);
        match.endMinute = match.completedAtMinute;

        match.winner = winner;
        match.loser = loser;
        match.status = 'completed';

        // Propagate winner
        if (match.winnerTo) {
          const dest = byId.get(match.winnerTo.matchId);
          if (dest) {
            const slotKey = match.winnerTo.slot === 1 ? 'slot1' : 'slot2';
            dest[slotKey] = { ...dest[slotKey], team: winner };
            if (dest.slot1.team && dest.slot2.team) {
              dest.status = 'ready';
            }
          }
        }

        // Propagate loser
        if (match.loserTo) {
          const dest = byId.get(match.loserTo.matchId);
          if (dest) {
            const slotKey = match.loserTo.slot === 1 ? 'slot1' : 'slot2';
            dest[slotKey] = { ...dest[slotKey], team: loser };
            if (dest.slot1.team && dest.slot2.team) {
              dest.status = 'ready';
            }
          }
        }

        // Check if tournament is complete (GF completed with no pending reset)
        const gf = byId.get('gf');
        const gfReset = byId.get('gf_reset');
        const isComplete = gf?.status === 'completed' &&
          (!gfReset?.resetActive || gfReset?.status === 'completed');

        recomputeSchedule(matches, tournament.numTeams, tournament.matchDurationMinutes);

        const updatedTournament = { ...tournament, matches };
        set({
          tournament: updatedTournament,
          phase: isComplete ? 'complete' : 'tournament',
          selectedMatchId: null,
        });

        // Push to Firebase if live
        const { isLive, liveSlug, tournamentName } = get();
        if (isLive && liveSlug) {
          pushTournament(liveSlug, tournamentName || liveSlug, updatedTournament).catch(
            (err) => console.error('Firebase sync failed:', err),
          );
        }
      },

      goLive: async (slug: string) => {
        const { tournament, tournamentName } = get();
        if (!tournament) return;
        await pushTournament(slug, tournamentName || slug, tournament);
        set({ isLive: true, liveSlug: slug });
      },

      enableBracketReset: () => {
        const { tournament } = get();
        if (!tournament) return;

        const matches = tournament.matches.map((m) => ({ ...m }));
        const byId = new Map(matches.map((m) => [m.id, m]));

        const gf = byId.get('gf');
        const reset = byId.get('gf_reset');
        if (!gf || !reset || gf.status !== 'completed') return;

        // GF winner is the LB champ (gf.slot2.team is the LB finalist since
        // slot1 = WB finalist, slot2 = LB finalist)
        const lbChamp = gf.winner;
        const wbChamp = gf.loser;
        if (!lbChamp || !wbChamp) return;

        // In reset, WB finalist (who just lost GF) is slot1,
        // LB finalist (who just won GF) is slot2.
        reset.slot1 = { team: wbChamp, sourceMatchId: 'gf', sourceOutcome: 'loser' };
        reset.slot2 = { team: lbChamp, sourceMatchId: 'gf', sourceOutcome: 'winner' };
        reset.status = 'ready';
        reset.resetActive = true;

        const updated = { ...tournament, matches };
        set({ tournament: updated });

        const { isLive, liveSlug, tournamentName } = get();
        if (isLive && liveSlug) {
          pushTournament(liveSlug, tournamentName || liveSlug, updated).catch(
            (err) => console.error('Firebase sync failed:', err),
          );
        }
      },

      getMatch: (id) => get().tournament?.matches.find((m) => m.id === id),
    }),
    {
      name: 'tennis-tournament-state',
    },
  ),
);
